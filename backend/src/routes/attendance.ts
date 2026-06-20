import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Middleware to enforce Teacher or Admin role
function requireTeacherOrAdmin(req: AuthenticatedRequest, res: Response, next: any) {
  if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Access Denied: Teacher or Administrator role required.' });
  }
  next();
}

// 1. Get attendance roster and overall status for a date (Teacher/Admin only)
router.get('/', authenticateJWT, requireTeacherOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date } = req.query;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ success: false, error: 'Date query parameter is required (format: YYYY-MM-DD).' });
    }

    // Fetch all active students from SQLite
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        name: true,
        class: true,
        stream: true,
      },
      orderBy: { name: 'asc' },
    });

    // Fetch existing attendance records for this date
    const attendanceRecords = await prisma.attendance.findMany({
      where: { date },
    });

    // Map records by studentId for fast lookup
    const recordMap = new Map(attendanceRecords.map(r => [r.userId, r.status]));

    // Determine the overall status of the day.
    let dayStatus = 'CLASS_HELD';
    if (attendanceRecords.length > 0) {
      const uniqueStatuses = Array.from(new Set(attendanceRecords.map(r => r.status)));
      if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 'HOLIDAY') {
        dayStatus = 'HOLIDAY';
      } else if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 'CANCELLED') {
        dayStatus = 'CANCELLED';
      }
    }

    const roster = students.map(student => ({
      id: student.id,
      name: student.name,
      class: student.class,
      stream: student.stream,
      status: recordMap.get(student.id) || null, // null if unmarked
    }));

    return res.status(200).json({
      success: true,
      data: {
        date,
        dayStatus,
        roster,
      },
    });
  } catch (error: any) {
    console.error('[Get Attendance Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Record attendance for a date (Teacher/Admin only)
router.post('/', authenticateJWT, requireTeacherOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, dayStatus, records, reason } = req.body;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ success: false, error: 'Date is required (format: YYYY-MM-DD).' });
    }
    if (!['CLASS_HELD', 'CANCELLED', 'HOLIDAY'].includes(dayStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid dayStatus. Must be CLASS_HELD, CANCELLED, or HOLIDAY.' });
    }

    // Check for retroactive edits (older than yesterday)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - target.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const isRetroactive = diffDays >= 2;

    if (isRetroactive) {
      if (!reason || typeof reason !== 'string' || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Retroactive change detected: A modification reason is required for attendance records older than 24 hours.'
        });
      }
    }

    const recordedBy = req.user!.id;

    // Fetch all active students
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: { id: true },
    });

    if (students.length === 0) {
      return res.status(400).json({ success: false, error: 'No students found to record attendance.' });
    }

    // Determine the status to write for each student
    let operations: any[] = [];

    if (dayStatus === 'HOLIDAY' || dayStatus === 'CANCELLED') {
      // Mark all students with HOLIDAY or CANCELLED status
      operations = students.map(student => ({
        userId: student.id,
        status: dayStatus,
      }));
    } else {
      // CLASS_HELD. Read records from body.
      if (!Array.isArray(records)) {
        return res.status(400).json({ success: false, error: 'records array is required when dayStatus is CLASS_HELD.' });
      }

      const bodyRecordsMap = new Map(records.map((r: any) => [r.studentId, r.status]));

      operations = students.map(student => {
        const studentStatus = bodyRecordsMap.get(student.id);
        return {
          userId: student.id,
          status: studentStatus === 'ABSENT' ? 'ABSENT' : 'PRESENT',
        };
      });
    }

    // Write all to SQLite database using transaction / upsert
    await prisma.$transaction(
      operations.map(op => prisma.attendance.upsert({
        where: {
          userId_date: {
            userId: op.userId,
            date,
          },
        },
        update: {
          status: op.status,
          recordedBy,
        },
        create: {
          userId: op.userId,
          date,
          status: op.status,
          recordedBy,
        },
      }))
    );

    // Add audit log
    await prisma.auditLog.create({
      data: {
        action: isRetroactive ? 'ATTENDANCE_RETROACTIVE_CHANGE' : 'ATTENDANCE_RECORDED',
        userId: req.user!.id,
        actorId: req.user!.id,
        details: isRetroactive
          ? `Retroactive attendance change for date ${date}. Status: ${dayStatus}. Reason: ${reason.trim()}`
          : `Attendance recorded for date ${date}. Status: ${dayStatus}.`,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Attendance recorded successfully.',
      },
    });
  } catch (error: any) {
    console.error('[Record Attendance Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Get monthly summary of attendance days (Teacher/Admin only)
router.get('/month-summary', authenticateJWT, requireTeacherOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, error: 'Month and year are required.' });
    }

    const monthStr = String(month).padStart(2, '0');
    const prefix = `${year}-${monthStr}-`;

    const records = await prisma.attendance.findMany({
      where: {
        date: {
          startsWith: prefix,
        },
      },
    });

    const dayStatuses: Record<string, string> = {};
    const dates = Array.from(new Set(records.map(r => r.date)));

    for (const d of dates) {
      const dayRecords = records.filter(r => r.date === d);
      const uniqueStatuses = Array.from(new Set(dayRecords.map(r => r.status)));
      if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 'HOLIDAY') {
        dayStatuses[d] = 'HOLIDAY';
      } else if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 'CANCELLED') {
        dayStatuses[d] = 'CANCELLED';
      } else {
        dayStatuses[d] = 'CLASS_HELD';
      }
    }

    return res.status(200).json({
      success: true,
      data: dayStatuses,
    });
  } catch (error: any) {
    console.error('[Month Summary Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Get attendance logs for the logged-in student (Student only)
router.get('/my-attendance', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const records = await prisma.attendance.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: records,
    });
  } catch (error: any) {
    console.error('[Student Attendance Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
