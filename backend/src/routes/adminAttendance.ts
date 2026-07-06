import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Campuses coordinates
const CAMPUSES: Record<string, { lat: number, lon: number }> = {
  'Madhyamgram': { lat: 22.693230336542225, lon: 88.45923267330267 },
  'Sodepur': { lat: 22.703237523450426, lon: 88.37139070110229 },
};

const GEOFENCE_RADIUS_METERS = 200; // Allow 200m radius for branch check-ins

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

  return R * c;
}

// Middleware to enforce Admin role
function requireAdmin(req: AuthenticatedRequest, res: Response, next: any) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Access Denied: Admin privileges required.' });
  }
  next();
}

// 1. Get my shifts (Admin only)
router.get('/shifts/my', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    
    // 1. Fetch actual shifts from DB
    const shifts = await prisma.adminShift.findMany({
      where: { adminId },
      include: {
        attendances: true,
      },
      orderBy: { date: 'desc' },
    });

    // 2. Fetch weekly recurring schedule patterns
    const patterns = await prisma.adminWeeklyPattern.findMany({
      where: { adminId },
    });

    // 3. Synthesize upcoming shifts for next 7 days (including today)
    const dates: { dateStr: string, dayOfWeek: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000));
      const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
      const formatter = new Intl.DateTimeFormat('en-CA', options);
      const dateStr = formatter.format(d);
      
      const dayOfWeek = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getDay();
      dates.push({ dateStr, dayOfWeek });
    }

    const existingShiftsByDate = new Map<string, any>();
    for (const shift of shifts) {
      existingShiftsByDate.set(shift.date, shift);
    }

    const resultShifts = [...shifts];
    for (const item of dates) {
      if (!existingShiftsByDate.has(item.dateStr)) {
        const pattern = patterns.find(p => p.dayOfWeek === item.dayOfWeek);
        if (pattern) {
          resultShifts.push({
            id: `recurring-${item.dateStr}-${pattern.id}`,
            adminId,
            branch: pattern.branch,
            date: item.dateStr,
            startTime: pattern.startTime,
            endTime: pattern.endTime,
            type: pattern.type,
            isRecurring: true,
            attendances: [],
            createdAt: pattern.createdAt,
            updatedAt: pattern.updatedAt,
          } as any);
        }
      }
    }

    // Sort descending by date
    resultShifts.sort((a, b) => b.date.localeCompare(a.date));

    return res.status(200).json({
      success: true,
      data: resultShifts,
    });
  } catch (error: any) {
    console.error('[Get Admin Shifts Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Ping / Check-in to Shift
router.post('/shifts/ping', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    let { shiftId, latitude, longitude } = req.body;

    if (!shiftId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, error: 'Missing shiftId, latitude, or longitude.' });
    }

    let shift: any = null;

    // Handle dynamic instantiation of recurring pattern shifts
    if (String(shiftId).startsWith('recurring-')) {
      const parts = String(shiftId).split('-');
      // format is recurring-YYYY-MM-DD-patternId
      if (parts.length < 5) {
        return res.status(400).json({ success: false, error: 'Invalid recurring shift ID format.' });
      }
      const targetDate = `${parts[1]}-${parts[2]}-${parts[3]}`;
      const patternId = parts.slice(4).join('-');

      // Verify the pattern exists
      const pattern = await prisma.adminWeeklyPattern.findUnique({
        where: { id: patternId },
      });

      if (!pattern || pattern.adminId !== adminId) {
        return res.status(404).json({ success: false, error: 'Recurring schedule pattern not found.' });
      }

      // Check if a real shift already exists for this date to prevent duplicates
      let existingShift = await prisma.adminShift.findFirst({
        where: { adminId, date: targetDate },
      });

      if (!existingShift) {
        // Instantiate the virtual shift into a real DB record
        existingShift = await prisma.adminShift.create({
          data: {
            adminId,
            branch: pattern.branch,
            date: targetDate,
            startTime: pattern.startTime,
            endTime: pattern.endTime,
            type: pattern.type,
          },
        });
      }

      shift = existingShift;
      shiftId = existingShift.id; // Override shiftId with the real created UUID
    } else {
      shift = await prisma.adminShift.findUnique({
        where: { id: shiftId },
      });
    }

    if (!shift) {
      return res.status(404).json({ success: false, error: 'Shift not found.' });
    }

    if (shift.adminId !== adminId) {
      return res.status(403).json({ success: false, error: 'This shift is not assigned to you.' });
    }

    // Strict Geofencing check if shift type is BRANCH_DUTY
    if (shift.type === 'BRANCH_DUTY') {
      const branchCoords = CAMPUSES[shift.branch];
      if (!branchCoords) {
        return res.status(400).json({ success: false, error: `Branch coordinates for '${shift.branch}' are not configured.` });
      }

      const distance = calculateHaversineDistance(latitude, longitude, branchCoords.lat, branchCoords.lon);
      if (distance > GEOFENCE_RADIUS_METERS) {
        return res.status(400).json({
          success: false,
          error: `Geofence check failed. You must be within ${GEOFENCE_RADIUS_METERS}m of ${shift.branch} branch. (Current distance: ${distance.toFixed(0)}m)`,
          distance,
        });
      }
    }

    // Check if attendance already exists
    let attendance = await prisma.adminAttendance.findFirst({
      where: { shiftId, adminId },
    });

    if (!attendance) {
      // Create new attendance check-in
      attendance = await prisma.adminAttendance.create({
        data: {
          adminId,
          shiftId,
          loginTime: new Date(),
          checkInLat: latitude,
          checkInLng: longitude,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error: any) {
    console.error('[Admin Ping Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Checkout from Shift
router.post('/shifts/checkout', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { shiftId, latitude, longitude } = req.body;

    if (!shiftId) {
      return res.status(400).json({ success: false, error: 'Missing shiftId.' });
    }

    const attendance = await prisma.adminAttendance.findFirst({
      where: { shiftId, adminId },
    });

    if (!attendance) {
      return res.status(400).json({ success: false, error: 'No active check-in record found for this shift.' });
    }

    const logoutTime = new Date();
    const workingHours = (logoutTime.getTime() - attendance.loginTime.getTime()) / (1000 * 60 * 60);

    const updated = await prisma.adminAttendance.update({
      where: { id: attendance.id },
      data: {
        logoutTime,
        workingHours: parseFloat(workingHours.toFixed(2)),
        checkOutLat: latitude !== undefined ? latitude : null,
        checkOutLng: longitude !== undefined ? longitude : null,
      },
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('[Admin Checkout Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
