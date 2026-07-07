import { Router, Response } from 'express';
import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { db, isFirebaseEnabled } from '../config/firebase';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { syncUserToFirestore, findUserByPhoneInFirestore } from './auth';
import { createNotificationAndPush } from '../utils/notifications';

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
        phoneNumber: formattedPhone,
        role,
        firstLogin: true,
        stream: role === 'STUDENT' && stream ? stream.trim() : null,
        class: role === 'STUDENT' && studentClass ? studentClass.trim() : null,
        faculty: role === 'STUDENT' && faculty ? faculty.trim() : null,
        school: role === 'STUDENT' && school ? school.trim() : null,
        subjects: subjects ? subjects.trim() : null,
      }
    });

    // Create a Welcome Notification and push alert for students
    await createNotificationAndPush(
      user.id,
      'Welcome to Mathemaniac!',
      'Your account has been created by the administrator. Please change your password on first login.'
    );

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

    // Retrieve users from PostgreSQL (Prisma) as the primary source of truth
    let users = await prisma.user.findMany({
      where: roleFilter ? { role: roleFilter } : undefined,
      orderBy: { createdAt: 'desc' }
    }) as any[];

    console.log(`[GET /users] total users from Prisma: ${users.length}`);

    // Self-healing backfill: if Firestore is enabled, fetch phone numbers for users having null/empty phoneNumber in SQLite/Postgres
    if (db) {
      try {
        const studentSnap = (!roleFilter || roleFilter === 'STUDENT') ? await db.collection('students').get() : null;
        const teacherSnap = (!roleFilter || roleFilter === 'TEACHER') ? await db.collection('teachers').get() : null;

        const firestoreUsersMap = new Map<string, any>();
        if (studentSnap) {
          studentSnap.forEach(doc => firestoreUsersMap.set(doc.id, doc.data()));
        }
        if (teacherSnap) {
          teacherSnap.forEach(doc => firestoreUsersMap.set(doc.id, doc.data()));
        }

        for (let u of users) {
          const fsUser = firestoreUsersMap.get(u.id);
          if (fsUser && fsUser.phoneNumber) {
            // If local phoneNumber is empty/null, save it
            if (!u.phoneNumber) {
              u.phoneNumber = fsUser.phoneNumber;
              await prisma.user.update({
                where: { id: u.id },
                data: { phoneNumber: fsUser.phoneNumber }
              });
            }
          }
        }
      } catch (fsErr) {
        console.error('[Get Users Firestore Sync Error]', fsErr);
      }
    }

    // Filter by query
    if (query) {
      users = users.filter(u => 
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.phoneNumber && u.phoneNumber.includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.class && u.class.toLowerCase().includes(query)) ||
        (u.stream && u.stream.toLowerCase().includes(query)) ||
        (u.faculty && u.faculty.toLowerCase().includes(query)) ||
        (u.school && u.school.toLowerCase().includes(query)) ||
        (u.subjects && u.subjects.toLowerCase().includes(query))
      );
    }

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

    const course = await prisma.course.findUnique({ 
      where: { id: courseId },
      include: { bundleItems: true }
    });
    if (!course) return res.status(404).json({ success: false, error: 'Course not found.' });

    const orderId = `manual_admin_${Date.now()}_${studentId.substring(0,5)}`;

    await prisma.purchase.create({
      data: {
        userId: studentId,
        courseId,
        amount: course.price,
        status: 'SUCCESS',
        razorpayOrderId: orderId
      }
    });

    if (course.isBundle && course.bundleItems && course.bundleItems.length > 0) {
      const subPurchases = course.bundleItems.map((item: any) => ({
        userId: studentId,
        courseId: item.courseId,
        amount: 0,
        status: 'SUCCESS',
        razorpayOrderId: `bundle_auto_${orderId.substring(0, 10)}_${item.courseId.substring(0, 8)}`,
      }));
      
      const existingSubPurchases = await prisma.purchase.findMany({
        where: { userId: studentId, courseId: { in: course.bundleItems.map((i: any) => i.courseId) } }
      });
      const existingCourseIds = existingSubPurchases.map((p: any) => p.courseId);
      
      const newSubPurchases = subPurchases.filter((p: any) => !existingCourseIds.includes(p.courseId));
      if (newSubPurchases.length > 0) {
        await prisma.purchase.createMany({ data: newSubPurchases });
      }
    }

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

// 7. Assign Teacher to Course (Allowed for all Admins)
router.post('/courses/:id/teachers', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
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

// 8. Remove Teacher from Course (Allowed for all Admins)
router.delete('/courses/:id/teachers/:teacherId', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
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

// 9. Create Course (Allowed for all Admins)
router.post('/courses', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, price, categoryId, learningOutcomes, timeSlots, branch, targetClass, isBundle, bundleCourseIds, thumbnailUrl } = req.body;
    let description = req.body.description || '';

    if (!title || price === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required course fields (title, price).' });
    }

    let finalCategoryId = categoryId;
    if (!finalCategoryId || finalCategoryId.trim() === '') {
      // Auto-detect category from title
      const subjectKeywords = ['Biology', 'Mathematics', 'Math', 'Physics', 'Chemistry', 'Computer', 'Science', 'English'];
      let detectedCategory = null;
      for (const keyword of subjectKeywords) {
        if (title.toLowerCase().includes(keyword.toLowerCase())) {
          detectedCategory = keyword;
          break;
        }
      }
      
      let targetSlug = detectedCategory ? detectedCategory.toLowerCase() : 'program';
      let targetName = detectedCategory ? detectedCategory : 'Program';

      let cat = await prisma.courseCategory.findFirst({ where: { slug: targetSlug } });
      if (!cat) {
        cat = await prisma.courseCategory.create({ data: { name: targetName, slug: targetSlug } });
      }
      finalCategoryId = cat.id;
    }

    const course = await prisma.course.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        thumbnailUrl: thumbnailUrl?.trim() || '',
        price: Number(price),
        categoryId: finalCategoryId.trim(),
        learningOutcomes: learningOutcomes || '[]',
        timeSlots: timeSlots ? JSON.stringify(timeSlots) : '[]',
        branch: branch || 'Sodepur',
        targetClass: targetClass || null,
        published: true,
        isBundle: !!isBundle,
        bundleItems: isBundle && Array.isArray(bundleCourseIds) ? {
          create: bundleCourseIds.map((cid: string) => ({
            courseId: cid
          }))
        } : undefined
      }
    });

    // Write to AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'COURSE_CREATED',
        userId: req.user!.id,
        actorId: req.user!.id,
        details: `Superuser created new course: ${course.title}.`,
      },
    });

    return res.status(201).json({ success: true, data: course });
  } catch (error: any) {
    console.error('[Create Course Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to create course.' });
  }
});

// Delete course (Allowed for all Admins)
router.delete('/courses/:id', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Delete associated records first (cascade deletes could also be configured in Prisma)
    await prisma.courseTeacher.deleteMany({ where: { courseId: id } });
    await prisma.purchase.deleteMany({ where: { courseId: id } });
    await prisma.lecture.deleteMany({ where: { courseId: id } });
    await prisma.test.deleteMany({ where: { courseId: id } });
    await prisma.studyMaterial.deleteMany({ where: { courseId: id } });

    await prisma.course.delete({ where: { id } });

    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update course (Allowed for all Admins)
router.put('/courses/:id', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, price, thumbnailUrl, categoryId, timeSlots, branch, targetClass, isBundle, bundleCourseIds } = req.body;
    let description = req.body.description || '';

    if (!title || price === undefined) {
      return res.status(400).json({ success: false, error: 'Title and price are required.' });
    }

    // Prepare update data
    const updateData: any = {
      title: title.trim(),
      description: description.trim(),
      price: parseInt(price.toString(), 10),
      thumbnailUrl: thumbnailUrl || null,
      categoryId: categoryId || null,
      timeSlots: timeSlots ? JSON.stringify(timeSlots) : '[]',
      branch: branch || 'Sodepur',
      targetClass: targetClass || null,
      isBundle: !!isBundle,
    };

    // Update the course
    const updatedCourse = await prisma.course.update({
      where: { id },
      data: updateData,
    });

    // Handle bundle items if applicable
    if (isBundle && Array.isArray(bundleCourseIds)) {
      // Delete existing bundle items first
      await prisma.bundleItem.deleteMany({ where: { bundleId: id } });
      
      // Re-create bundle items
      if (bundleCourseIds.length > 0) {
        await prisma.bundleItem.createMany({
          data: bundleCourseIds.map((cid: string) => ({
            bundleId: id,
            courseId: cid
          }))
        });
      }
    }

    // Write to AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'COURSE_UPDATED',
        userId: req.user!.id,
        actorId: req.user!.id,
        details: `Superuser updated course: ${updatedCourse.title}.`,
      },
    });

    return res.status(200).json({ success: true, data: updatedCourse });
  } catch (error: any) {
    console.error('[Update Course Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update course.' });
  }
});

// Update User Details (Admin Only)
router.put('/users/:id', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, stream, class: studentClass, school, faculty, subjects } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name: name?.trim() || existingUser.name,
        email: email?.trim() || existingUser.email,
        stream: stream?.trim() !== undefined ? stream.trim() : existingUser.stream,
        class: studentClass?.trim() !== undefined ? studentClass.trim() : existingUser.class,
        school: school?.trim() !== undefined ? school.trim() : existingUser.school,
        faculty: faculty?.trim() !== undefined ? faculty.trim() : existingUser.faculty,
        subjects: subjects?.trim() !== undefined ? subjects.trim() : existingUser.subjects,
      },
    });

    // Write to AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'ADMIN_UPDATE_USER',
        userId: id,
        actorId: req.user!.id,
        details: `Admin updated user details for ${updatedUser.name}.`,
      },
    });

    // Sync to Firestore
    await syncUserToFirestore(updatedUser);

    return res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('[Admin Update User Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update user.' });
  }
});

// Holidays Management Routes
router.post('/holidays', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, title } = req.body;
    if (!date || !title) {
      return res.status(400).json({ success: false, error: 'Date and title are required.' });
    }

    const existing = await prisma.holiday.findUnique({
      where: { date },
    });
    if (existing) {
      return res.status(400).json({ success: false, error: 'A holiday is already scheduled on this date.' });
    }

    const holiday = await prisma.holiday.create({
      data: { date, title },
    });

    return res.status(201).json({
      success: true,
      data: holiday,
    });
  } catch (error: any) {
    console.error('[Admin Add Holiday Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/holidays', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: 'asc' },
    });
    return res.status(200).json({
      success: true,
      data: holidays,
    });
  } catch (error: any) {
    console.error('[Admin Get Holidays Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/holidays/:id', authenticateJWT, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.holiday.delete({
      where: { id },
    });
    return res.status(200).json({
      success: true,
      message: 'Holiday removed successfully.',
    });
  } catch (error: any) {
    console.error('[Admin Delete Holiday Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
 
