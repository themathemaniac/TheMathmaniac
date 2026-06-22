import { Router, Response } from 'express';
import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { db, isFirebaseEnabled } from '../config/firebase';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { syncUserToFirestore, findUserByPhoneInFirestore } from './auth';

const router = Router();

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

const SUPERUSER_PHONES = ['+917980357754', '+919831754957'];

// Middleware to enforce Admin role or Superuser
function requireAdmin(req: AuthenticatedRequest, res: Response, next: any) {
  const isSuperuser = req.user?.phoneNumber && SUPERUSER_PHONES.includes(req.user.phoneNumber);
  if (req.user?.role !== 'ADMIN' && !isSuperuser) {
    return res.status(403).json({ success: false, error: 'Access Denied: Administrator role required.' });
  }
  next();
}

// 1. Create User (Admin Only)
router.post('/users', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, phoneNumber, role, email, stream, class: studentClass, faculty, school, subjects } = req.body;

    if (!name || !phoneNumber || !role) {
      return res.status(400).json({ success: false, error: 'Name, phone number, and role are required.' });
    }
    if (role !== 'STUDENT' && role !== 'TEACHER') {
      return res.status(400).json({ success: false, error: 'Role must be either STUDENT or TEACHER.' });
    }

    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = `+91${formattedPhone}`;
      } else {
        return res.status(400).json({ success: false, error: 'Invalid phone number format.' });
      }
    }

    // Check if user already exists in Firestore
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

    // Create local user in SQLite without credentials
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email ? email.trim() : null,
        role,
        firstLogin: true,
        stream: role === 'STUDENT' && stream ? stream.trim() : null,
        class: role === 'STUDENT' && studentClass ? studentClass.trim() : null,
        faculty: role === 'STUDENT' && faculty ? faculty.trim() : null,
        school: role === 'STUDENT' && school ? school.trim() : null,
        subjects: role === 'TEACHER' && subjects ? subjects.trim() : null,
      }
    });

    // Create a Welcome Notification for students
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Welcome to Mathemaniac!',
        body: 'Your account has been created by the administrator. Please change your password on first login.',
      },
    });

    // Write to AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'USER_CREATED',
        userId: user.id,
        actorId: req.user!.id,
        details: `Admin created user ${user.name} (${role}) with phone ${formattedPhone}.`,
      },
    });

    // Sync to Firestore along with credentials
    await syncUserToFirestore(user, {
      phoneNumber: formattedPhone,
      passwordHash,
      passphraseHash
    });

    // Return the plaintext credentials ONLY ONCE in response
    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          phoneNumber: formattedPhone,
          role: user.role,
          email: user.email,
        },
        temporaryPassword: plaintextTempPassword,
        recoveryPassphrase: plaintextPassphrase
      }
    });
  } catch (error: any) {
    console.error('[Admin Create User Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to create user.' });
  }
});

// 2. Administrative Recovery: Reset Password & Regenerate Passphrase (Admin Only)
router.post('/users/:id/recovery', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Get phone number from Firestore
    let formattedPhone = '';
    if (db) {
      const collName = targetUser.role === 'STUDENT' ? 'students' : 'teachers';
      const doc = await db.collection(collName).doc(targetUserId).get();
      if (doc.exists) {
        formattedPhone = doc.data()!.phoneNumber || '';
      }
    }

    if (!formattedPhone) {
      return res.status(400).json({ success: false, error: 'User phone number not found in Firestore.' });
    }

    const plaintextTempPassword = 'Password@123';
    const plaintextPassphrase = generatePassphrase();

    // Hashing
    const passwordHash = await bcrypt.hash(plaintextTempPassword, 10);
    const passphraseHash = await bcrypt.hash(plaintextPassphrase, 10);

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        firstLogin: true
      }
    });

    // Write to AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'ACCOUNT_RECOVERY',
        userId: targetUserId,
        actorId: req.user!.id,
        details: `Admin triggered recovery for ${targetUser.name}. Password reset to default, new passphrase generated, and firstLogin reset to true.`,
      },
    });

    // Sync updated user and credentials to Firestore
    await syncUserToFirestore(updatedUser, {
      phoneNumber: formattedPhone,
      passwordHash,
      passphraseHash
    });

    return res.status(200).json({
      success: true,
      data: {
        temporaryPassword: plaintextTempPassword,
        recoveryPassphrase: plaintextPassphrase
      }
    });
  } catch (error: any) {
    console.error('[Admin Recover User Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to perform recovery.' });
  }
});

// 3. List and Search Users (Admin Only)
router.get('/users', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim().toLowerCase();
    const roleFilter = req.query.role as string || '';

    let users: any[] = [];

    console.log('[GET /users] DB Status:', db ? 'Initialized' : 'NULL');

    if (db) {
      if (!roleFilter || roleFilter === 'STUDENT') {
        const studentSnap = await db.collection('students').get();
        console.log(`[GET /users] studentSnap size: ${studentSnap.size}`);
        studentSnap.forEach(doc => {
          const data = doc.data();
          users.push({ id: doc.id, role: 'STUDENT', ...data });
        });
      }

      if (!roleFilter || roleFilter === 'TEACHER') {
        const teacherSnap = await db.collection('teachers').get();
        console.log(`[GET /users] teacherSnap size: ${teacherSnap.size}`);
        teacherSnap.forEach(doc => {
          const data = doc.data();
          users.push({ id: doc.id, role: 'TEACHER', ...data });
        });
      }
    }
    console.log(`[GET /users] total users fetched: ${users.length}`);

    // Filter by query
    if (query) {
      users = users.filter(u => 
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.phoneNumber && u.phoneNumber.includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.class && u.class.toLowerCase().includes(query)) ||
        (u.stream && u.stream.toLowerCase().includes(query)) ||
        (u.faculty && u.faculty.toLowerCase().includes(query)) ||
        (u.school && u.school.toLowerCase().includes(query))
      );
    }

    // Sort by createdAt descending
    users.sort((a, b) => {
      const dateA = a.createdAt ? (a.createdAt.seconds || new Date(a.createdAt).getTime()) : 0;
      const dateB = b.createdAt ? (b.createdAt.seconds || new Date(b.createdAt).getTime()) : 0;
      return dateB - dateA;
    });

    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (error: any) {
    console.error('[Admin List Users Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to list users.' });
  }
});

// 3.5. Delete User (Admin Only)
router.delete('/users/:id', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Get phone number from Firestore for audit log before deleting
    let formattedPhone = '';
    if (db) {
      const collName = targetUser.role === 'STUDENT' ? 'students' : 'teachers';
      const doc = await db.collection(collName).doc(targetUserId).get();
      if (doc.exists) {
        formattedPhone = doc.data()!.phoneNumber || '';
      }
    }

    // Write to AuditLog first before deleting the user record
    await prisma.auditLog.create({
      data: {
        action: 'USER_DELETED',
        userId: targetUserId,
        actorId: req.user!.id,
        details: `Admin deleted user ${targetUser.name} (${targetUser.role}) with phone ${formattedPhone || 'N/A'}.`,
      },
    });

    // Delete related records in SQLite in a transaction to satisfy foreign keys
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { userId: targetUserId } }),
      prisma.lectureProgress.deleteMany({ where: { userId: targetUserId } }),
      prisma.purchase.deleteMany({ where: { userId: targetUserId } }),
      prisma.result.deleteMany({ where: { userId: targetUserId } }),
      prisma.user.delete({ where: { id: targetUserId } }),
    ]);

    // Delete from Firestore if enabled
    if (isFirebaseEnabled && db) {
      let collectionName = 'students';
      if (targetUser.role === 'TEACHER') {
        collectionName = 'teachers';
      } else if (targetUser.role === 'ADMIN') {
        collectionName = 'admin';
      }
      await db.collection(collectionName).doc(targetUserId).delete();
      console.log(`[Firebase Delete] Deleted user ${targetUserId} from Firestore collection "${collectionName}".`);
    }

    return res.status(200).json({
      success: true,
      data: { message: 'User deleted successfully.' }
    });
  } catch (error: any) {
    console.error('[Admin Delete User Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to delete user.' });
  }
});

// 4. List Audit Logs (Admin Only)
router.get('/audit-logs', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit to latest 100 events
    });

    return res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error: any) {
    console.error('[Admin List Logs Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to list audit logs.' });
  }
});

// 5. List Courses with Details (Admin & Superuser)
router.get('/courses', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        category: true,
        teachers: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        purchases: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        _count: { select: { purchases: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ success: true, data: courses });
  } catch (error: any) {
    console.error('[Admin List Courses Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to list courses.' });
  }
});

// 6. Enroll Student to Course (Admin & Superuser)
router.post('/courses/:id/enroll', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { studentId } = req.body;
    const courseId = req.params.id;

    if (!studentId) return res.status(400).json({ success: false, error: 'Student ID is required.' });

    const existingPurchase = await prisma.purchase.findFirst({
      where: { userId: studentId, courseId }
    });

    if (existingPurchase) {
      return res.status(400).json({ success: false, error: 'Student is already enrolled in this course.' });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ success: false, error: 'Course not found.' });

    await prisma.purchase.create({
      data: {
        userId: studentId,
        courseId,
        amount: course.price,
        status: 'SUCCESS',
        razorpayOrderId: `manual_admin_${Date.now()}_${studentId.substring(0,5)}`
      }
    });

    // Write to AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'COURSE_ENROLLMENT',
        userId: studentId,
        actorId: req.user!.id,
        details: `Admin enrolled student ${studentId} into course ${course.title}.`,
      },
    });

    return res.status(200).json({ success: true, data: { message: 'Student enrolled successfully.' } });
  } catch (error: any) {
    console.error('[Admin Enroll Student Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to enroll student.' });
  }
});

// Middleware to enforce Superuser for Admin
function requireAdminSuperuser(req: AuthenticatedRequest, res: Response, next: any) {
  if (!req.user || !SUPERUSER_PHONES.includes(req.user.phoneNumber)) {
    return res.status(403).json({ success: false, error: 'Access Denied: Superuser privileges required.' });
  }
  next();
}

// 7. Assign Teacher to Course (Superuser Only)
router.post('/courses/:id/teachers', authenticateJWT, requireAdmin, requireAdminSuperuser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { teacherId } = req.body;
    const courseId = req.params.id;

    if (!teacherId) return res.status(400).json({ success: false, error: 'Teacher ID is required.' });

    const existing = await prisma.courseTeacher.findUnique({
      where: { courseId_userId: { courseId, userId: teacherId } }
    });

    if (existing) return res.status(400).json({ success: false, error: 'Teacher is already assigned to this course.' });

    await prisma.courseTeacher.create({
      data: { courseId, userId: teacherId }
    });

    return res.status(200).json({ success: true, data: { message: 'Teacher assigned successfully.' } });
  } catch (error: any) {
    console.error('[Assign Teacher Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to assign teacher.' });
  }
});

// 8. Remove Teacher from Course (Superuser Only)
router.delete('/courses/:id/teachers/:teacherId', authenticateJWT, requireAdmin, requireAdminSuperuser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, teacherId } = req.params;

    await prisma.courseTeacher.deleteMany({
      where: { courseId: id, userId: teacherId }
    });

    return res.status(200).json({ success: true, data: { message: 'Teacher removed successfully.' } });
  } catch (error: any) {
    console.error('[Remove Teacher Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to remove teacher.' });
  }
});

const COURSE_CREATOR_PHONE = '+919831754957'; // Shubhadeep Biswas

// 9. Create Course (Restricted to specific Superuser)
router.post('/courses', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !req.user.phoneNumber.includes('9831754957')) {
      return res.status(403).json({ success: false, error: 'Access Denied: Only authorized superusers can create courses.' });
    }

    const { title, description, thumbnailUrl, price, categoryId, instructorName, learningOutcomes } = req.body;

    if (!title || !description || price === undefined || !categoryId || !instructorName) {
      return res.status(400).json({ success: false, error: 'Missing required course fields.' });
    }

    const course = await prisma.course.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        thumbnailUrl: thumbnailUrl?.trim() || '',
        price: Number(price),
        categoryId: categoryId.trim(),
        instructorName: instructorName.trim(),
        learningOutcomes: learningOutcomes || '[]',
        published: true,
      }
    });

    // Write to AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'COURSE_CREATED',
        userId: req.user.id,
        actorId: req.user.id,
        details: `Superuser created new course: ${course.title}.`,
      },
    });

    return res.status(201).json({ success: true, data: course });
  } catch (error: any) {
    console.error('[Create Course Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to create course.' });
  }
});

export default router;
