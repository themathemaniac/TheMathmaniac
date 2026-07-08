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
    const { date, courseId } = req.query;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ success: false, error: 'Date query parameter is required (format: YYYY-MM-DD).' });
    }

    if (!courseId || typeof courseId !== 'string') {
      return res.status(400).json({ success: false, error: 'courseId query parameter is required.' });
    }

    // Fetch students enrolled in this specific course
    const purchases = await prisma.purchase.findMany({
      where: { courseId, status: 'SUCCESS' },
      include: { user: true },
    });
    
    // Sort students alphabetically
    const students = purchases
      .map(p => p.user)
      .filter(u => u.role === 'STUDENT')
      .sort((a, b) => a.name.localeCompare(b.name));

    // Fetch existing attendance records for this date AND courseId
    const attendanceRecords = await prisma.attendance.findMany({
      where: { date, courseId },
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
    const { date, courseId, dayStatus, records, reason } = req.body;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ success: false, error: 'Date is required (format: YYYY-MM-DD).' });
    }
    if (!courseId || typeof courseId !== 'string') {
      return res.status(400).json({ success: false, error: 'courseId is required.' });
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
    // Fetch active students in this specific course
    const purchases = await prisma.purchase.findMany({
      where: { courseId, status: 'SUCCESS' },
      select: { userId: true },
    });
    const students = purchases.map(p => ({ id: p.userId }));

    if (students.length === 0) {
      return res.status(400).json({ success: false, error: 'No students found enrolled in this course to record attendance.' });
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
    // Write all to SQLite database using transaction / upsert
    // Note: Due to changing from @@unique([userId, date]) to @@unique([userId, courseId, date])
    // The where clause needs userId_courseId_date. Since courseId could historically be null, 
    // we use prisma.attendance.findFirst inside a loop, or delete and recreate to be safer with SQLite.
    
    // To handle courseId being added, we'll just delete existing and create many.
    await prisma.$transaction(async (tx) => {
      await tx.attendance.deleteMany({
        where: { date, courseId, userId: { in: students.map(s => s.id) } }
      });
      
      await tx.attendance.createMany({
        data: operations.map(op => ({
          userId: op.userId,
          courseId,
          date,
          status: op.status,
          recordedBy,
        }))
      });
    });

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

// Geofence Coordinate Constants (Institute Locations)
const CAMPUSES: Record<string, { lat: number, lon: number }> = {
  'Madhyamgram': { lat: 22.693230336542225, lon: 88.45923267330267 },
  'Sodepur': { lat: 22.703237523450426, lon: 88.37139070110229 },
};
const GEOFENCE_RADIUS_METERS = 15;

// Haversine formula to compute geodesic distance in meters
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

// 5. Get Teacher Schedules (Auto-Generated from Course TimeSlots)
router.get('/teacher/schedule', authenticateJWT, requireTeacherOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user?.role === 'ADMIN';

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // CLEANUP: Delete future schedules that have no attendance logged, 
    // so if a course was deleted, its future schedules disappear.
    await prisma.teacherSchedule.deleteMany({
      where: {
        date: { gte: todayStr },
        teacherAttendances: { none: {} },
        ...(isAdmin ? {} : { userId })
      }
    });

    // Auto-generate schedules for the next 14 days based on Course assignments
    const next14Days: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      next14Days.push(d.toISOString().split('T')[0]);
    }
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const courseTeachers = await prisma.courseTeacher.findMany({
      where: isAdmin ? undefined : { userId },
      include: { course: { include: { category: true } }, user: true }
    });

    for (const ct of courseTeachers) {
      const course = ct.course;
      if (!course.timeSlots) continue;
      
      let slots: any[] = [];
      try {
        slots = JSON.parse(course.timeSlots);
      } catch(e) {}
      
      for (const slot of slots) {
        if (!slot.day || !slot.startTime || !slot.endTime) continue;
        const slotDayStr = slot.day.substring(0, 3); 
        
        for (const dateStr of next14Days) {
          const d = new Date(dateStr);
          const dayName = shortDays[d.getDay()];
          if (dayName === slotDayStr) {
            const title = course.title;
            const campus = course.branch || 'Madhyamgram';
            const targetClass = course.targetClass || '';
            const subject = course.category?.name || '';
            
            const existing = await prisma.teacherSchedule.findFirst({
               where: { userId: ct.userId, date: dateStr, startTime: slot.startTime, endTime: slot.endTime, title }
            });
            
            if (!existing) {
               await prisma.teacherSchedule.create({
                  data: {
                     userId: ct.userId,
                     title,
                     campus,
                     class: targetClass,
                     subject,
                     date: dateStr,
                     startTime: slot.startTime,
                     endTime: slot.endTime
                  }
               });
            }
          }
        }
      }
    }

    // Now retrieve all schedules
    const schedules = await prisma.teacherSchedule.findMany({
      where: isAdmin ? undefined : { userId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { date: 'desc' },
    });

    // Map schedules to include campus coordinates
    const schedulesWithCoords = schedules.map(s => ({
      ...s,
      campusCoords: CAMPUSES[s.campus] || CAMPUSES['Madhyamgram']
    }));

    return res.status(200).json({
      success: true,
      data: schedulesWithCoords,
    });
  } catch (error: any) {
    console.error('[Get Teacher Schedules Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Log Location Ping for Geofencing Check
router.post('/teacher/ping', authenticateJWT, requireTeacherOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { latitude, longitude, scheduleId } = req.body;

    if (latitude === undefined || longitude === undefined || !scheduleId) {
      return res.status(400).json({ success: false, error: 'latitude, longitude, and scheduleId are required.' });
    }

    const schedule = await prisma.teacherSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule || schedule.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Valid schedule not found.' });
    }

    // Get the scheduled campus coordinates
    const targetCampus = CAMPUSES[schedule.campus] || CAMPUSES['Madhyamgram'];

    // Calculate distance
    const distance = calculateHaversineDistance(latitude, longitude, targetCampus.lat, targetCampus.lon);
    const isInside = distance <= GEOFENCE_RADIUS_METERS;

    // Log the ping
    const log = await prisma.teacherLocationLog.create({
      data: {
        userId,
        scheduleId,
        latitude,
        longitude,
        distance,
        isInside,
      },
    });

    // Check if TeacherAttendance already exists for this schedule
    const existingAttendance = await prisma.teacherAttendance.findFirst({
      where: { scheduleId }
    });

    if (!existingAttendance) {
      // First ping marks the login time / check-in
      await prisma.teacherAttendance.create({
        data: {
          userId,
          scheduleId,
          date: schedule.date,
          status: 'PARTIAL',
          presenceRatio: isInside ? 1.0 : 0.0,
          totalPings: 1,
          insidePings: isInside ? 1 : 0,
          loginTime: new Date(),
        }
      });
      console.log(`[Geofence Ping] User ${userId} first ping. Initialized TeacherAttendance with loginTime.`);
    } else {
      // Update counts incrementally for accurate real-time logging
      await prisma.teacherAttendance.update({
        where: { id: existingAttendance.id },
        data: {
          totalPings: { increment: 1 },
          insidePings: isInside ? { increment: 1 } : undefined,
          presenceRatio: (existingAttendance.insidePings + (isInside ? 1 : 0)) / (existingAttendance.totalPings + 1)
        }
      });
    }

    console.log(`[Geofence Ping] User ${userId} pinged lat:${latitude}, lon:${longitude} - Dist: ${distance.toFixed(1)}m | Inside: ${isInside}`);

    return res.status(200).json({
      success: true,
      data: {
        isInside,
        distance,
        timestamp: log.timestamp,
      },
    });
  } catch (error: any) {
    console.error('[Teacher Location Ping Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Teacher Checkout & Attendance Verdict calculation
router.post('/teacher/checkout', authenticateJWT, requireTeacherOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { scheduleId } = req.body;

    if (!scheduleId) {
      return res.status(400).json({ success: false, error: 'scheduleId is required.' });
    }

    const schedule = await prisma.teacherSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule || schedule.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Schedule record not found.' });
    }

    // Fetch all logs
    const logs = await prisma.teacherLocationLog.findMany({
      where: { scheduleId },
    });

    const totalPings = logs.length;
    const insidePings = logs.filter(l => l.isInside).length;
    const presenceRatio = totalPings > 0 ? insidePings / totalPings : 0;

    let status = 'ABSENT';
    if (presenceRatio >= 0.8) {
      status = 'PRESENT';
    } else if (presenceRatio >= 0.2) {
      status = 'PARTIAL';
    }

    // Check if attendance already recorded
    const existingAttendance = await prisma.teacherAttendance.findFirst({
      where: { scheduleId },
    });

    let attendance;
    if (existingAttendance) {
      // Calculate teaching hours duration
      const logoutTime = new Date();
      const loginTime = existingAttendance.loginTime || existingAttendance.createdAt || new Date();
      const durationHours = (logoutTime.getTime() - new Date(loginTime).getTime()) / (1000 * 60 * 60);
      const roundedHours = Math.round(durationHours * 10) / 10; // Round to 1 decimal

      attendance = await prisma.teacherAttendance.update({
        where: { id: existingAttendance.id },
        data: {
          status,
          presenceRatio,
          totalPings,
          insidePings,
          logoutTime,
          teachingHours: roundedHours > 0 ? roundedHours : 0.1, // Minimum 0.1 hours
        },
      });
    } else {
      // Fallback: if they never pinged but somehow hit checkout directly
      const logoutTime = new Date();
      const loginTime = new Date(new Date().setMinutes(new Date().getMinutes() - 60)); // assume 1 hour ago
      const durationHours = 1.0;

      attendance = await prisma.teacherAttendance.create({
        data: {
          userId,
          scheduleId,
          date: schedule.date,
          status,
          presenceRatio,
          totalPings,
          insidePings,
          loginTime,
          logoutTime,
          teachingHours: durationHours,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        message: 'Checkout completed successfully.',
        attendance,
      },
    });
  } catch (error: any) {
    console.error('[Teacher Checkout Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Get Geotagged Attendance History
router.get('/teacher/attendance', authenticateJWT, requireTeacherOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const attendance = await prisma.teacherAttendance.findMany({
      where: { userId },
      include: {
        schedule: true,
      },
      orderBy: { date: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error: any) {
    console.error('[Get Teacher Attendance History Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
