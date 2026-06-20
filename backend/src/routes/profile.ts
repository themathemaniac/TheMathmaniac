import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// 1. Get User Profile Details & Analytics Summary
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        stream: true,
        class: true,
        faculty: true,
        school: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userWithPhone = {
      ...user,
      phoneNumber: req.user?.phoneNumber || '',
    };

    // Performance numbers
    let stats = {};
    if (user.role === 'TEACHER' || user.role === 'ADMIN') {
      const totalStudents = await prisma.user.count({
        where: { role: 'STUDENT' },
      });
      const totalCourses = await prisma.course.count();
      const totalTests = await prisma.test.count();
      const totalMaterials = await prisma.studyMaterial.count();

      stats = {
        totalStudents,
        totalCourses,
        totalTests,
        totalMaterials,
      };
    } else {
      const totalPurchased = await prisma.purchase.count({
        where: { userId, status: 'SUCCESS' },
      });

      const completedProgress = await prisma.lectureProgress.count({
        where: { userId, completed: true },
      });

      const testResults = await prisma.result.findMany({
        where: { userId },
        select: { score: true, accuracy: true, test: { select: { totalMarks: true } } },
      });

      const totalTestsAttempted = testResults.length;
      const averageAccuracy = totalTestsAttempted > 0
        ? testResults.reduce((acc, row) => acc + row.accuracy, 0) / totalTestsAttempted
        : 0;

      stats = {
        purchasedCoursesCount: totalPurchased,
        completedLecturesCount: completedProgress,
        testsAttemptedCount: totalTestsAttempted,
        averageTestAccuracy: Math.round(averageAccuracy),
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        profile: userWithPhone,
        stats,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get Purchased Courses list
router.get('/courses', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const purchases = await prisma.purchase.findMany({
      where: { userId, status: 'SUCCESS' },
      include: {
        course: {
          include: {
            _count: {
              select: { lectures: true },
            },
          },
        },
      },
    });

    const courseList = purchases.map((purchase) => {
      const course = purchase.course;
      return {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnailUrl,
        instructorName: course.instructorName,
        lectureCount: course._count.lectures,
      };
    });

    return res.status(200).json({ success: true, data: courseList });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Get Announcements Feed
router.get('/announcements', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    return res.status(200).json({ success: true, data: announcements });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Get User Notifications
router.get('/notifications', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.status(200).json({ success: true, data: notifications });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Mark Notifications as Read
router.post('/notifications/read-all', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return res.status(200).json({ success: true, data: { message: 'All notifications marked as read' } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
