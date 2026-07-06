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
    const shifts = await prisma.adminShift.findMany({
      where: { adminId },
      include: {
        attendances: true,
      },
      orderBy: { date: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: shifts,
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
    const { shiftId, latitude, longitude } = req.body;

    if (!shiftId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, error: 'Missing shiftId, latitude, or longitude.' });
    }

    const shift = await prisma.adminShift.findUnique({
      where: { id: shiftId },
    });

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
