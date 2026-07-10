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
    
    // Fetch actual shifts from DB
    const shifts = await prisma.adminShift.findMany({
      where: { adminId },
      include: {
        attendances: true,
      },
      orderBy: { date: 'desc' },
    });

    // Fetch weekly recurring schedule patterns
    const patterns = await prisma.adminWeeklyPattern.findMany({
      where: { adminId },
    });

    // Fetch approved branch swaps
    const approvedSwaps = await prisma.adminBranchSwapRequest.findMany({
      where: { adminId, status: 'APPROVED' }
    });
    const swapMap = new Map(approvedSwaps.map(s => [s.date, s.requestedBranch]));

    // Synthesize upcoming shifts for next 7 days (including today)
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

    const existingBranchShiftsByDate = new Set<string>();
    for (const shift of shifts) {
      if (swapMap.has(shift.date)) {
        shift.branch = swapMap.get(shift.date)!;
      }
      if (shift.type === 'BRANCH_DUTY') {
        existingBranchShiftsByDate.add(shift.date);
      }
    }

    const resultShifts = [...shifts];
    for (const item of dates) {
      if (!existingBranchShiftsByDate.has(item.dateStr)) {
        const pattern = patterns.find(p => p.dayOfWeek === item.dayOfWeek);
        if (pattern) {
          const activeBranch = swapMap.get(item.dateStr) || pattern.branch;
          resultShifts.push({
            id: `recurring-${item.dateStr}-${pattern.id}`,
            adminId,
            branch: activeBranch,
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
        // Check for an approved branch swap request
        const approvedSwap = await prisma.adminBranchSwapRequest.findFirst({
          where: { adminId, date: targetDate, status: 'APPROVED' }
        });
        const activeBranch = approvedSwap ? approvedSwap.requestedBranch : pattern.branch;

        // Instantiate the virtual shift into a real DB record
        existingShift = await prisma.adminShift.create({
          data: {
            adminId,
            branch: activeBranch,
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

      if (shift) {
        // Check for an approved branch swap request
        const approvedSwap = await prisma.adminBranchSwapRequest.findFirst({
          where: { adminId, date: shift.date, status: 'APPROVED' }
        });
        if (approvedSwap && shift.branch !== approvedSwap.requestedBranch) {
          shift = await prisma.adminShift.update({
            where: { id: shift.id },
            data: { branch: approvedSwap.requestedBranch },
          });
        }
      }
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

// Helper for Superusers
const SUPERUSERS = ['+917980357754', '+919831754957'];
function requireSuperuser(req: AuthenticatedRequest, res: Response, next: any) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Access Denied: Admin privileges required.' });
  }
  const isSuper = req.user.phoneNumber && SUPERUSERS.includes(req.user.phoneNumber);
  if (!isSuper) {
    return res.status(403).json({ success: false, error: 'Access Denied: Superuser privileges required.' });
  }
  next();
}

// 4. Update Shift Type (Branch Duty vs Field Promotion)
router.post('/shifts/update-type', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { shiftId, type, description } = req.body;

    if (!shiftId || !type) {
      return res.status(400).json({ success: false, error: 'Missing shiftId or type.' });
    }

    if (type !== 'BRANCH_DUTY' && type !== 'FIELD_PROMOTION') {
      return res.status(400).json({ success: false, error: 'Invalid shift type.' });
    }

    let shift = await prisma.adminShift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      return res.status(404).json({ success: false, error: 'Shift not found.' });
    }

    if (shift.adminId !== adminId) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const updatedShift = await prisma.adminShift.update({
      where: { id: shiftId },
      data: { type },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        action: 'ADMIN_SHIFT_TYPE_UPDATE',
        userId: adminId,
        actorId: adminId,
        details: `Admin changed active shift type to ${type}. Reason: ${description || 'N/A'}`
      }
    });

    return res.status(200).json({
      success: true,
      data: updatedShift,
    });
  } catch (error: any) {
    console.error('[Update Shift Type Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Request Branch Swap for Today
router.post('/shifts/request-swap', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { date, requestedBranch } = req.body;

    if (!date || !requestedBranch) {
      return res.status(400).json({ success: false, error: 'Missing date or requestedBranch.' });
    }

    // Upsert the swap request for today
    const swapRequest = await prisma.adminBranchSwapRequest.upsert({
      where: {
        adminId_date: {
          adminId,
          date,
        },
      },
      update: {
        requestedBranch,
        status: 'PENDING',
      },
      create: {
        adminId,
        date,
        requestedBranch,
        status: 'PENDING',
      },
    });

    return res.status(200).json({
      success: true,
      data: swapRequest,
    });
  } catch (error: any) {
    console.error('[Request Branch Swap Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Get My Active Swap Request for Today
router.get('/shifts/my-swap-request', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, error: 'Missing date parameter.' });
    }

    const swapRequest = await prisma.adminBranchSwapRequest.findUnique({
      where: {
        adminId_date: {
          adminId,
          date: String(date),
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: swapRequest,
    });
  } catch (error: any) {
    console.error('[Get My Swap Request Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Get All Swap Requests (Superuser only)
router.get('/shifts/swap-requests', authenticateJWT, requireSuperuser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requests = await prisma.adminBranchSwapRequest.findMany({
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    console.error('[Get All Swap Requests Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Approve/Reject Swap Request (Superuser only)
router.post('/shifts/approve-swap', authenticateJWT, requireSuperuser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId, status } = req.body;

    if (!requestId || !status) {
      return res.status(400).json({ success: false, error: 'Missing requestId or status.' });
    }

    if (status !== 'APPROVED' && status !== 'REJECTED') {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }

    const request = await prisma.adminBranchSwapRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Swap request not found.' });
    }

    const updatedRequest = await prisma.adminBranchSwapRequest.update({
      where: { id: requestId },
      data: { status },
    });

    // If approved, update active instantiated shift for today if it exists
    if (status === 'APPROVED') {
      const activeShift = await prisma.adminShift.findFirst({
        where: { adminId: request.adminId, date: request.date },
      });

      if (activeShift) {
        await prisma.adminShift.update({
          where: { id: activeShift.id },
          data: { branch: request.requestedBranch },
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: updatedRequest,
    });
  } catch (error: any) {
    console.error('[Approve/Reject Swap Request Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Check-in for Field Promotion
router.post('/shifts/field-promotion', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { latitude, longitude, locationName } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, error: 'Missing latitude or longitude.' });
    }

    const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const dateStr = formatter.format(new Date());

    // Create a new shift for the field promotion on this date
    const shift = await prisma.adminShift.create({
      data: {
        adminId,
        branch: 'Field',
        date: dateStr,
        type: 'FIELD_PROMOTION',
      },
    });

    // Create attendance check-in for this shift
    const attendance = await prisma.adminAttendance.create({
      data: {
        adminId,
        shiftId: shift.id,
        loginTime: new Date(),
        checkInLat: latitude,
        checkInLng: longitude,
        locationName: locationName || null,
      },
    });

    return res.status(200).json({
      success: true,
      data: { shift, attendance },
    });
  } catch (error: any) {
    console.error('[Admin Field Promotion Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
