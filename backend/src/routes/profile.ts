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

      // Aggregate teaching hours
      const teacherAttendance = await prisma.teacherAttendance.findMany({
        where: { userId },
        select: { teachingHours: true }
      });
      const teachingHoursSum = teacherAttendance.reduce((acc, row) => acc + (row.teachingHours || 0), 0);

      // Count unique assigned courses (batches)
      const batchesManaged = await prisma.courseTeacher.count({
        where: { userId }
      });

      stats = {
        totalStudents,
        totalCourses,
        totalTests,
        totalMaterials,
        teachingHours: Math.round(teachingHoursSum * 10) / 10,
        batchesManaged,
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

    let feeStatus = {
      hasPendingPayment: false,
      unpaidCourses: [] as string[]
    };

    if (user.role === 'STUDENT') {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const currentMonth = `${now.getFullYear()}-${mm}`;

      const purchases = await prisma.purchase.findMany({
        where: { userId, status: 'SUCCESS' },
        include: { course: true }
      });

      const unpaid: string[] = [];

      for (const purchase of purchases) {
        const payment = await prisma.feePayment.findFirst({
          where: {
            userId,
            courseId: purchase.courseId,
            month: currentMonth,
            status: 'SUCCESS'
          }
        });

        if (!payment) {
          unpaid.push(purchase.course.title);
        }
      }

      if (unpaid.length > 0) {
        feeStatus = {
          hasPendingPayment: true,
          unpaidCourses: unpaid
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        profile: userWithPhone,
        stats,
        feeStatus,
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
      where: {
        userId,
        status: 'SUCCESS',
      },
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

    const courseList = purchases.map((p) => {
      const course = p.course;
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

// 3. Get Announcements Feed (For Student Purchased Batches)
router.get('/announcements', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get purchased courses
    const purchases = await prisma.purchase.findMany({
      where: {
        userId,
        status: 'SUCCESS',
      },
      select: {
        courseId: true,
      },
    });
    const purchasedCourseIds = purchases.map((p) => p.courseId);

    const announcements = await prisma.announcement.findMany({
      where: {
        courseId: { in: purchasedCourseIds }
      },
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
      orderBy: { createdAt: 'desc' },
      take: 15,
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

// 6. Consolidated Calendar (Holidays + Classes)
router.get('/calendar', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const holidays = await prisma.holiday.findMany({
      orderBy: { date: 'asc' },
    });

    let classes: any[] = [];

    if (user.role === 'STUDENT') {
      // Fetch purchased courses
      const purchases = await prisma.purchase.findMany({
        where: { userId, status: 'SUCCESS' },
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
        }
      });

      const now = new Date();
      const currentYear = now.getFullYear();

      for (const p of purchases) {
        const slots = JSON.parse(p.course.timeSlots || '[]');
        const teacherName = p.course.teachers[0]?.user?.name || 'Faculty';

        slots.forEach((slot: any) => {
          const targetDay = parseInt(slot.day, 10);
          if (isNaN(targetDay)) return;

          let tempDate = new Date(currentYear, 0, 1);
          while (tempDate.getFullYear() === currentYear) {
            if (tempDate.getDay() === targetDay) {
              const dateStr = tempDate.toISOString().split('T')[0];
              classes.push({
                date: dateStr,
                title: `${p.course.title}`,
                subtitle: `${slot.time || 'Class'} (${teacherName})`,
                type: 'CLASS',
              });
            }
            tempDate.setDate(tempDate.getDate() + 1);
          }
        });
      }
    } else if (user.role === 'TEACHER') {
      const schedules = await prisma.teacherSchedule.findMany({
        where: { userId },
      });
      classes = schedules.map(s => ({
        date: s.date,
        title: s.title,
        subtitle: `${s.startTime} - ${s.endTime} (${s.campus})`,
        type: 'CLASS',
      }));
    } else {
      const schedules = await prisma.teacherSchedule.findMany({
        include: {
          user: {
            select: { name: true }
          }
        }
      });
      classes = schedules.map(s => ({
        date: s.date,
        title: s.title,
        subtitle: `${s.startTime} - ${s.endTime} (${s.user?.name || 'Teacher'})`,
        type: 'CLASS',
      }));
    }

    const calendarEvents = [
      ...holidays.map(h => ({
        date: h.date,
        title: `Holiday: ${h.title}`,
        subtitle: 'No Classes',
        type: 'HOLIDAY',
      })),
      ...classes,
    ];

    return res.status(200).json({
      success: true,
      data: calendarEvents,
    });
  } catch (error: any) {
    console.error('[Get Calendar Events Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Register / Update Expo Push Token
router.post('/push-token', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({ success: false, error: 'Push token is required.' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { pushToken: pushToken.trim() },
    });

    return res.status(200).json({
      success: true,
      message: 'Push token registered successfully.',
    });
  } catch (error: any) {
    console.error('[Register Push Token Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
