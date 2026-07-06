import { Router, Response } from 'express';
import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { db, isFirebaseEnabled } from '../config/firebase';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { generateDailyReport } from '../services/reportBuilder';
import { syncUserToFirestore, findUserByPhoneInFirestore } from './auth';

const router = Router();

// Defined Superuser Phone Numbers (Raunak Dey and Shubhadeep Biswas)
const SUPERUSER_PHONES = ['+917980357754', '+919831754957'];

// Middleware to enforce Superuser access only
export function requireSuperuser(req: AuthenticatedRequest, res: Response, next: any) {
  if (!req.user || !SUPERUSER_PHONES.includes(req.user.phoneNumber)) {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: You do not have superuser privileges.'
    });
  }
  next();
}

// Passphrase generator helpers
const ADJECTIVES = [
  'SUNSET', 'MOON', 'SILENT', 'OCEAN', 'GOLDEN', 'WILD', 'DARK', 'LIGHT', 'SHADOW', 'RIVER',
  'BLUE', 'GREEN', 'STARRY', 'VIBRANT', 'SLEEK', 'GLOWING', 'BRAVE', 'BRIGHT', 'COOL', 'SWEET'
];
const NOUNS = [
  'RIVER', 'TIGER', 'EAGLE', 'MOUNTAIN', 'FOREST', 'WIND', 'STORM', 'CLOVER', 'FIRE', 'SKY',
  'WAVE', 'PEAK', 'VALLEY', 'LAKE', 'TREE', 'HAWK', 'PANTHER', 'WOLF', 'BEAR', 'SHIELD'
];
function generatePassphrase(): string {
  const adj = ADJECTIVES[crypto.randomInt(0, ADJECTIVES.length)];
  const noun = NOUNS[crypto.randomInt(0, NOUNS.length)];
  const num = crypto.randomInt(1000, 9999);
  return `${adj}-${noun}-${num}`;
}

// 1. Get History of Daily PDF Attendance Reports (Superuser only)
router.get('/reports', authenticateJWT, requireSuperuser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reports = await prisma.dailyReport.findMany({
      orderBy: { date: 'desc' },
    });
    return res.status(200).json({ success: true, data: reports });
  } catch (error: any) {
    console.error('[Get Superuser Reports Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. On-Demand / Force Generate Daily Report (Superuser only)
router.post('/reports/generate', authenticateJWT, requireSuperuser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date } = req.body;
    const result = await generateDailyReport(date);
    return res.status(200).json({
      success: true,
      data: {
        message: 'Report compiled successfully.',
        report: {
          title: result.title,
          date: result.date,
          pdfUrl: result.url,
        }
      }
    });
  } catch (error: any) {
    console.error('[Generate Report Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. List Branch Admins (excluding Superusers)
router.get('/admins', authenticateJWT, requireSuperuser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        NOT: {
          phoneNumber: { in: SUPERUSER_PHONES }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, data: admins });
  } catch (error: any) {
    console.error('[List Admins Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Create New Branch Admin (Superuser only)
router.post('/admins', authenticateJWT, requireSuperuser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, phoneNumber, email } = req.body;
    if (!name || !phoneNumber) {
      return res.status(400).json({ success: false, error: 'Name and phone number are required.' });
    }

    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = `+91${formattedPhone}`;
      } else {
        return res.status(400).json({ success: false, error: 'Invalid phone number format.' });
      }
    }

    // Check if user already exists in Firestore/Prisma
    const existing = await findUserByPhoneInFirestore(formattedPhone);
    if (existing) {
      return res.status(400).json({ success: false, error: 'User with this phone number already exists.' });
    }

    // Default temporary credentials
    const plaintextTempPassword = 'Password@123';
    const plaintextPassphrase = generatePassphrase();

    // Secure Hashing
    const passwordHash = await bcrypt.hash(plaintextTempPassword, 10);
    const passphraseHash = await bcrypt.hash(plaintextPassphrase, 10);

    // Create local user record
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email ? email.trim() : null,
        phoneNumber: formattedPhone,
        role: 'ADMIN',
        firstLogin: true,
      }
    });

    // Write to AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'USER_CREATED',
        userId: user.id,
        actorId: req.user!.id,
        details: `Superuser created new admin ${user.name} with phone ${formattedPhone}.`,
      },
    });

    // Sync to Firestore under 'admin' collection
    await syncUserToFirestore(user, {
      phoneNumber: formattedPhone,
      passwordHash,
      passphraseHash
    });

    return res.status(201).json({
      success: true,
      data: {
        user,
        tempPass: plaintextTempPassword,
        passphrase: plaintextPassphrase,
      }
    });
  } catch (error: any) {
    console.error('[Create Admin Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Delete Branch Admin (Superuser only)
router.delete('/admins/:id', authenticateJWT, requireSuperuser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Admin not found.' });
    }

    if (targetUser.role !== 'ADMIN') {
      return res.status(400).json({ success: false, error: 'This user is not an Admin.' });
    }

    // Audit logs entry
    await prisma.auditLog.create({
      data: {
        action: 'USER_DELETED',
        userId: targetUserId,
        actorId: req.user!.id,
        details: `Superuser deleted branch admin ${targetUser.name} (${targetUser.phoneNumber}).`,
      },
    });

    // Cascaded delete in SQLite (Prisma transaction)
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { userId: targetUserId } }),
      prisma.adminShift.deleteMany({ where: { adminId: targetUserId } }),
      prisma.adminAttendance.deleteMany({ where: { adminId: targetUserId } }),
      prisma.user.delete({ where: { id: targetUserId } }),
    ]);

    // Firestore deletion
    if (isFirebaseEnabled && db) {
      await db.collection('admin').doc(targetUserId).delete();
      console.log(`[Firebase Delete] Deleted admin ${targetUserId} from Firestore.`);
    }

    return res.status(200).json({ success: true, message: 'Admin deleted successfully.' });
  } catch (error: any) {
    console.error('[Delete Admin Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Create / Assign Shift to Admin (Superuser only)
router.post('/shifts', authenticateJWT, requireSuperuser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { adminId, branch, date, startTime, endTime, type } = req.body;
    if (!adminId || !branch || !date || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'All fields (adminId, branch, date, startTime, endTime) are required.' });
    }

    const shift = await prisma.adminShift.create({
      data: {
        adminId,
        branch,
        date,
        startTime,
        endTime,
        type: type || 'BRANCH_DUTY',
      },
      include: {
        admin: true,
      }
    });

    return res.status(201).json({ success: true, data: shift });
  } catch (error: any) {
    console.error('[Create Shift Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Get All Scheduled Shifts (Superuser only)
router.get('/shifts', authenticateJWT, requireSuperuser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shifts = await prisma.adminShift.findMany({
      include: {
        admin: true,
        attendances: true,
      },
      orderBy: { date: 'desc' }
    });
    return res.status(200).json({ success: true, data: shifts });
  } catch (error: any) {
    console.error('[Get Shifts Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Delete / Cancel Shift (Superuser only)
router.delete('/shifts/:id', authenticateJWT, requireSuperuser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shiftId = req.params.id;
    await prisma.adminShift.delete({
      where: { id: shiftId }
    });
    return res.status(200).json({ success: true, message: 'Shift deleted successfully.' });
  } catch (error: any) {
    console.error('[Delete Shift Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
