import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { createNotificationAndPush } from '../utils/notifications';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

// Setup upload directory
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// 1. Get Study Materials (Supports courseId filtering, requires auth)
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { courseId } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const isAdminOrSuper = userRole === 'ADMIN' || userRole === 'SUPERUSER';
    const isTeacherRole = userRole === 'TEACHER';

    let allowedCourseIds: string[] = [];
    if (userId && !isAdminOrSuper) {
      if (isTeacherRole) {
        const assigned = await prisma.courseTeacher.findMany({
          where: { userId },
          select: { courseId: true },
        });
        allowedCourseIds = assigned.map((a) => a.courseId);
      } else {
        const purchases = await prisma.purchase.findMany({
          where: {
            userId,
            status: 'SUCCESS',
          },
          select: {
            courseId: true,
          },
        });
        allowedCourseIds = purchases.map((p) => p.courseId);
      }
    }

    const whereClause: any = {};
    if (courseId) {
      whereClause.courseId = String(courseId);
    }

    if (!isAdminOrSuper) {
      if (courseId) {
        if (!allowedCourseIds.includes(String(courseId))) {
          return res.status(200).json({ success: true, data: [] });
        }
      } else {
        whereClause.courseId = { in: allowedCourseIds };
      }
    }

    const materials = await prisma.studyMaterial.findMany({
      where: whereClause,
      include: {
        course: {
          select: { title: true, price: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const materialsWithAccess = materials.map((mat) => {
      const isAccessible = isAdminOrSuper || allowedCourseIds.includes(mat.courseId);

      return {
        id: mat.id,
        courseId: mat.courseId,
        courseTitle: mat.course.title,
        title: mat.title,
        type: mat.type,
        fileSize: mat.fileSize,
        fileUrl: mat.fileUrl,
        isAccessible,
      };
    });

    return res.status(200).json({ success: true, data: materialsWithAccess });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Create Study Material with PDF Upload (Requires Auth)
router.post('/', authenticateJWT, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, type, courseId } = req.body;
    if (!title || !type || !courseId) {
      return res.status(400).json({ success: false, error: 'Title, type, and courseId are required' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'A PDF file is required' });
    }

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    const material = await prisma.studyMaterial.create({
      data: {
        courseId,
        title,
        type,
        fileSize: req.file.size,
        fileData: req.file.buffer,
        fileUrl: '',
      },
    });

    const fileUrl = `${req.protocol}://${req.get('host')}/api/v1/materials/${material.id}/download`;

    await prisma.studyMaterial.update({
      where: { id: material.id },
      data: { fileUrl },
    });
    material.fileUrl = fileUrl;

    // Notify all students who purchased the course
    const purchases = await prisma.purchase.findMany({
      where: { courseId, status: 'SUCCESS' },
      select: { userId: true },
    });

    for (const purchase of purchases) {
      createNotificationAndPush(
        purchase.userId,
        `New Study Material: ${course.title} 📚`,
        `New study material "${title}" (${type}) has been uploaded.`
      ).catch((e) => console.error('[Material Notif Error]', e));
    }

    return res.status(201).json({ success: true, data: material });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Update Study Material (Supports PDF Replacement and text fields)
router.put('/:id', authenticateJWT, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, type, courseId } = req.body;

    const existingMaterial = await prisma.studyMaterial.findUnique({
      where: { id },
    });
    if (!existingMaterial) {
      return res.status(404).json({ success: false, error: 'Study material not found' });
    }

    const updateData: any = {};
    if (title) updateData.title = title;
    if (type) updateData.type = type;
    if (courseId) {
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) {
        return res.status(404).json({ success: false, error: 'Course not found' });
      }
      updateData.courseId = courseId;
    }

    // If new file is uploaded
    if (req.file) {
      updateData.fileSize = req.file.size;
      updateData.fileData = req.file.buffer;
    }

    const updatedMaterial = await prisma.studyMaterial.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({ success: true, data: updatedMaterial });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Delete Study Material (Deletes DB record along with binary data)
router.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingMaterial = await prisma.studyMaterial.findUnique({
      where: { id },
    });
    if (!existingMaterial) {
      return res.status(404).json({ success: false, error: 'Study material not found' });
    }

    await prisma.studyMaterial.delete({
      where: { id },
    });

    return res.status(200).json({ success: true, data: { message: 'Study material deleted successfully' } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Download Study Material PDF
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const material = await prisma.studyMaterial.findUnique({
      where: { id },
      select: { fileData: true, title: true, type: true }
    });

    if (!material || !material.fileData) {
      return res.status(404).send('File not found');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(material.title)}.pdf"`);
    res.send(material.fileData);
  } catch (error: any) {
    console.error('Download error:', error);
    res.status(500).send('Error downloading file');
  }
});

export default router;
