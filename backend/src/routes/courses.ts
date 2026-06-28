import { Router, Response } from 'express';
import prisma from '../config/db';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mathemaniac_secret_key';

// Helper to check token optionally
function getOptionalUserId(authHeader: string | undefined): string | null {
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      return decoded.id;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// 1. Get Categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.courseCategory.findMany();
    return res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get Courses (Supports search, category filters, and limit)
router.get('/', async (req, res) => {
  try {
    const { category, search, assigned } = req.query;
    const whereClause: any = {};

    if (category) {
      whereClause.category = { slug: String(category) };
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    // Always check if current user purchased these courses
    const userId = getOptionalUserId(req.headers.authorization);

    if (assigned === 'true' && userId) {
      whereClause.teachers = {
        some: { userId: userId }
      };
    }

    const courses = await prisma.course.findMany({
      where: whereClause,
      include: {
        category: true,
        teachers: {
          include: {
            user: { select: { name: true } }
          }
        },
        _count: {
          select: { lectures: true },
        },
      },
    });

    const coursesWithPurchaseInfo = courses.map((course) => ({
      ...course,
      isPurchased: true,
      lectureCount: course._count.lectures,
    }));

    return res.status(200).json({ success: true, data: coursesWithPurchaseInfo });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Get Course Details by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getOptionalUserId(req.headers.authorization);

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        category: true,
        teachers: {
          include: {
            user: {
              select: { id: true, name: true, subjects: true }
            }
          }
        },
        lectures: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            duration: true,
            sortOrder: true,
          },
        },
        _count: {
          select: { lectures: true },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    // Determine purchase status
    let isPurchased = true;
    let progressList: any[] = [];

    if (userId) {

      // Fetch progress for this user on this course's lectures
      progressList = await prisma.lectureProgress.findMany({
        where: {
          userId,
          lecture: { courseId: id },
        },
      });
    }

    // Return detailed course, embedding public details + outline
    return res.status(200).json({
      success: true,
      data: {
        ...course,
        isPurchased,
        learningOutcomes: JSON.parse(course.learningOutcomes as string || '[]'),
        lectureCount: course._count.lectures,
        lectures: course.lectures.map((lecture) => {
          const progress = progressList.find((p) => p.lectureId === lecture.id);
          return {
            ...lecture,
            lastPosition: progress ? progress.lastPosition : 0,
            completed: progress ? progress.completed : false,
          };
        }),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Update Course Theme (Teacher, Admin, Superuser)
router.put('/:id/theme', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { thumbnailUrl } = req.body;

    if (!thumbnailUrl) {
      return res.status(400).json({ success: false, error: 'Thumbnail URL is required' });
    }

    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userPhone = req.user?.phoneNumber;

    if (!userId || !userRole) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Superusers allow
    const isSuperuser = userPhone === '+917980357754' || userPhone === '+919831754957';
    
    if (!isSuperuser && userRole !== 'ADMIN' && userRole !== 'TEACHER') {
      return res.status(403).json({ success: false, error: 'Access Denied: Must be a teacher or admin.' });
    }

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        teachers: true
      }
    });

    if (!course) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    // If teacher, check if they are assigned to this course
    if (!isSuperuser && userRole === 'TEACHER') {
      const isAssigned = course.teachers.some((t: any) => t.userId === userId);
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Access Denied: You are not assigned to this course.' });
      }
    }

    // Update the course
    await prisma.course.update({
      where: { id },
      data: { thumbnailUrl }
    });

    return res.status(200).json({ success: true, message: 'Theme updated successfully' });

  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Get Course Students (Teacher/Admin)
router.get('/:id/students', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    
    const isSuperuser = req.user?.phoneNumber === '+917980357754' || req.user?.phoneNumber === '+919831754957';
    if (userRole !== 'TEACHER' && userRole !== 'ADMIN' && !isSuperuser) {
      return res.status(403).json({ success: false, error: 'Access Denied' });
    }

    // Find all successful purchases for this course
    const purchases = await prisma.purchase.findMany({
      where: { courseId: id, status: 'SUCCESS' },
      include: {
        user: {
          select: { id: true, name: true, email: true, school: true, stream: true }
        }
      }
    });

    const students = purchases.map(p => p.user);
    return res.status(200).json({ success: true, data: students });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Get Course Announcements
router.get('/:id/announcements', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const announcements = await prisma.announcement.findMany({
      where: { courseId: id },
      include: {
        course: {
          include: {
            teachers: {
              include: {
                user: {
                  select: { name: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mapped = announcements.map((announce) => {
      const courseTeachers = announce.course?.teachers || [];
      const fallbackTeacher = courseTeachers.length > 0 ? courseTeachers[0].user?.name : 'Teacher';
      return {
        ...announce,
        authorName: announce.authorName || announce.course?.instructorName || fallbackTeacher
      };
    });

    return res.status(200).json({ success: true, data: mapped });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Create Course Announcement (Teacher/Admin)
router.post('/:id/announcements', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const userRole = req.user?.role;

    const isSuperuser = req.user?.phoneNumber === '+917980357754' || req.user?.phoneNumber === '+919831754957';
    if (userRole !== 'TEACHER' && userRole !== 'ADMIN' && !isSuperuser) {
      return res.status(403).json({ success: false, error: 'Access Denied' });
    }

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    // Look up the name of the user who is posting the announcement
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: { name: true }
    });
    const authorName = user?.name || 'Instructor';

    const announcement = await (prisma.announcement as any).create({
      data: {
        title,
        content,
        courseId: id,
        authorName
      }
    });

    return res.status(201).json({ success: true, data: announcement });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Delete Course Announcement (Teacher/Admin)
router.delete('/:id/announcements/:announcementId', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, announcementId } = req.params;
    const userRole = req.user?.role;

    const isSuperuser = req.user?.phoneNumber === '+917980357754' || req.user?.phoneNumber === '+919831754957';
    if (userRole !== 'TEACHER' && userRole !== 'ADMIN' && !isSuperuser) {
      return res.status(403).json({ success: false, error: 'Access Denied' });
    }

    await prisma.announcement.delete({
      where: { id: announcementId }
    });

    return res.status(200).json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
