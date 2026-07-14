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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

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

    const isTeacher = userRole === 'TEACHER' || userRole === 'ADMIN' || userRole === 'SUPERUSER';

    let purchasedCourseIds: string[] = [];
    if (userId && !isTeacher) {
      const purchases = await prisma.purchase.findMany({
        where: {
          userId,
          status: 'SUCCESS',
        },
        select: {
          courseId: true,
        },
      });
      purchasedCourseIds = purchases.map((p) => p.courseId);
    }

    const whereClause: any = {};
    if (courseId) {
      whereClause.courseId = String(courseId);
    }

    if (!isTeacher) {
      whereClause.course = {
        OR: [
          { id: { in: purchasedCourseIds } },
          { price: 0 }
        ]
      };
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
      const isAccessible = isTeacher || mat.course.price === 0 || purchasedCourseIds.includes(mat.courseId);

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

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    const material = await prisma.studyMaterial.create({
      data: {
        courseId,
        title,
        type,
        fileSize: req.file.size,
        fileUrl,
      },
    });

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
      // Try to delete old file
      try {
        const oldFilename = existingMaterial.fileUrl.split('/uploads/')[1];
        if (oldFilename) {
          const oldFilePath = path.join(uploadDir, oldFilename);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
      } catch (err) {
        console.error('Error deleting old file:', err);
      }

      updateData.fileSize = req.file.size;
      updateData.fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
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

// 4. Delete Study Material (Unlinks file and deletes DB record)
router.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingMaterial = await prisma.studyMaterial.findUnique({
      where: { id },
    });
    if (!existingMaterial) {
      return res.status(404).json({ success: false, error: 'Study material not found' });
    }

    // Delete file from disk
    try {
      const filename = existingMaterial.fileUrl.split('/uploads/')[1];
      if (filename) {
        const filePath = path.join(uploadDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      console.error('Error deleting file:', err);
    }

    await prisma.studyMaterial.delete({
      where: { id },
    });

    return res.status(200).json({ success: true, data: { message: 'Study material deleted successfully' } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
