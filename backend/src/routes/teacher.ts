import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Middleware to enforce Teacher role
function requireTeacher(req: AuthenticatedRequest, res: Response, next: any) {
  if (req.user?.role !== 'TEACHER') {
    return res.status(403).json({ success: false, error: 'Access Denied: Teacher role required.' });
  }
  next();
}

// 1. Get Teacher Schedules for the next 7 days
router.get('/schedules', authenticateJWT, requireTeacher, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Shift by IST offset (5 hours 30 mins) to ensure we evaluate "today" in IST
    const istOffset = 5.5 * 60 * 60 * 1000;
    const getISTDateStr = (timestamp: number) => new Date(timestamp + istOffset).toISOString().split('T')[0];

    const todayMs = Date.now();
    const todayStr = getISTDateStr(todayMs);
    
    // Get date 7 days from now in IST
    const nextWeekMs = todayMs + 7 * 24 * 60 * 60 * 1000;
    const nextWeekStr = getISTDateStr(nextWeekMs);

    const schedules = await prisma.teacherSchedule.findMany({
      where: {
        userId: req.user!.id,
        date: {
          gte: todayStr,
          lte: nextWeekStr,
        }
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' }
      ]
    });

    return res.status(200).json({ success: true, data: schedules });
  } catch (error: any) {
    console.error('[Get Teacher Schedules Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Reschedule a specific class
router.put('/schedules/:id/reschedule', authenticateJWT, requireTeacher, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scheduleId = req.params.id;
    const { newDate, newStartTime, newEndTime, newCampus } = req.body;

    if (!newDate || !newStartTime || !newEndTime) {
      return res.status(400).json({ success: false, error: 'newDate, newStartTime, and newEndTime are required.' });
    }

    // Verify ownership
    const schedule = await prisma.teacherSchedule.findUnique({
      where: { id: scheduleId }
    });

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found.' });
    }

    if (schedule.userId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Access Denied: You do not own this schedule.' });
    }

    const updatedSchedule = await prisma.teacherSchedule.update({
      where: { id: scheduleId },
      data: {
        date: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        campus: newCampus || schedule.campus,
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'TEACHER_RESCHEDULED_CLASS',
        userId: req.user!.id,
        actorId: req.user!.id,
        details: `Teacher ${req.user!.phoneNumber} rescheduled class ${schedule.title} to ${newDate} (${newStartTime}-${newEndTime}) at ${newCampus || schedule.campus}.`,
      }
    });

    return res.status(200).json({ success: true, data: updatedSchedule, message: 'Class rescheduled successfully.' });
  } catch (error: any) {
    console.error('[Reschedule Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
