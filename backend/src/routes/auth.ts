import { Router, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { db, isFirebaseEnabled } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import * as bcrypt from 'bcryptjs';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { loginRateLimiter, recordLoginFailure, clearLoginAttempts } from '../middleware/rateLimiter';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mathemaniac_secret_key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'mathemaniac_refresh_key';
const RESET_TOKEN_SECRET = JWT_SECRET + '_reset';

export async function syncUserToFirestore(
  user: { id: string; role: string },
  creds?: { phoneNumber?: string; passwordHash?: string; passphraseHash?: string }
) {
  if (isFirebaseEnabled && db) {
    try {
      let collectionName = 'students';
      if (user.role === 'TEACHER') {
        collectionName = 'teachers';
      } else if (user.role === 'ADMIN') {
        collectionName = 'admin';
      }

      const userRef = db.collection(collectionName).doc(user.id);
      
      const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!fullUser) return;

      const dataToSync: any = {
        id: fullUser.id,
        name: fullUser.name,
        role: fullUser.role,
        firstLogin: fullUser.firstLogin,
        stream: fullUser.stream || null,
        class: fullUser.class || null,
        faculty: fullUser.faculty || null,
        school: fullUser.school || null,
        createdAt: fullUser.createdAt,
        updatedAt: fullUser.updatedAt,
      };

      if (fullUser.email) dataToSync.email = fullUser.email;

      if (creds) {
        if (creds.phoneNumber) dataToSync.phoneNumber = creds.phoneNumber;
        if (creds.passwordHash) dataToSync.passwordHash = creds.passwordHash;
        if (creds.passphraseHash) dataToSync.passphraseHash = creds.passphraseHash;
      }

      await userRef.set(dataToSync, { merge: true });
      console.log(`[Firebase Sync] Synchronized user ${fullUser.id} to Firestore collection "${collectionName}".`);
    } catch (firebaseErr: any) {
      console.error('[Firebase Sync Error]', firebaseErr.message || firebaseErr);
    }
  }
}

function generateTokens(payload: { id: string; phoneNumber: string; role: string }) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

export async function findUserByPhoneInFirestore(formattedPhone: string) {
  if (!db) return null;
  
  const collections = ['students', 'teachers', 'admin'];
  for (const collName of collections) {
    const snapshot = await db.collection(collName).where('phoneNumber', '==', formattedPhone).limit(1).get();
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        role: collName === 'students' ? 'STUDENT' : (collName === 'teachers' ? 'TEACHER' : 'ADMIN')
      } as any;
    }
  }
  return null;
}

// 1. Password Login (Rate Limited)
router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    if (!phoneNumber || !password) {
      return res.status(400).json({ success: false, error: 'Phone number and password are required.' });
    }

    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = `+91${formattedPhone}`;
      } else {
        return res.status(400).json({ success: false, error: 'Invalid phone number format.' });
      }
    }

    // Find user by phoneNumber in Firestore
    const firestoreUser = await findUserByPhoneInFirestore(formattedPhone);

    if (!firestoreUser || !firestoreUser.passwordHash) {
      recordLoginFailure(req);
      return res.status(400).json({ success: false, error: 'Incorrect phone number or password.' });
    }

    const isMatch = await bcrypt.compare(password, firestoreUser.passwordHash);
    if (!isMatch) {
      recordLoginFailure(req);
      return res.status(400).json({ success: false, error: 'Incorrect phone number or password.' });
    }

    // Clear failed attempts upon successful login
    clearLoginAttempts(req);

    // Ensure user exists in local SQLite db
    let user = await prisma.user.findUnique({ where: { id: firestoreUser.id } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: firestoreUser.id,
          name: firestoreUser.name,
          email: firestoreUser.email || null,
          role: firestoreUser.role,
          firstLogin: firestoreUser.firstLogin !== undefined ? firestoreUser.firstLogin : true,
          stream: firestoreUser.stream || null,
          class: firestoreUser.class || null,
          faculty: firestoreUser.faculty || null,
          school: firestoreUser.school || null,
        }
      });
    } else {
      // Keep name, role, firstLogin, and other fields up to date in SQLite
      user = await prisma.user.update({
        where: { id: firestoreUser.id },
        data: {
          name: firestoreUser.name,
          email: firestoreUser.email || null,
          role: firestoreUser.role,
          firstLogin: firestoreUser.firstLogin !== undefined ? firestoreUser.firstLogin : user.firstLogin,
          stream: firestoreUser.stream || null,
          class: firestoreUser.class || null,
          faculty: firestoreUser.faculty || null,
          school: firestoreUser.school || null,
        }
      });
    }

    const tokens = generateTokens({ id: user.id, phoneNumber: firestoreUser.phoneNumber, role: user.role });
    
    // Sync back non-credentials details
    await syncUserToFirestore(user);

    return res.status(200).json({
      success: true,
      data: {
        ...tokens,
        user: {
          id: user.id,
          name: user.name,
          phoneNumber: firestoreUser.phoneNumber,
          role: user.role,
          firstLogin: user.firstLogin,
        },
      },
    });
  } catch (error: any) {
    console.error('[Login Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Login failed.' });
  }
});

// 2. Register (Disabled for Self-Registration)
router.post('/register', async (req, res) => {
  return res.status(403).json({
    success: false,
    error: 'Registration is restricted to administrators. Please contact administration to create your account.',
  });
});

// 3. Change Password (Mandatory / Profile)
router.post('/change-password', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstLogin: false,
      },
    });

    // Write to AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_CHANGE',
        userId: updatedUser.id,
        actorId: userId,
        details: `User changed their password. firstLogin set to false.`,
      },
    });

    // Sync updated user to Firestore along with new passwordHash
    await syncUserToFirestore(updatedUser, {
      phoneNumber: req.user?.phoneNumber || '',
      passwordHash
    });

    return res.status(200).json({
      success: true,
      data: { message: 'Password updated successfully.' },
    });
  } catch (error: any) {
    console.error('[Change Password Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update password.' });
  }
});

// 4. Forgot Password - Verify Passphrase
router.post('/forgot-password/verify', async (req, res) => {
  try {
    const { phoneNumber, passphrase } = req.body;

    if (!phoneNumber || !passphrase) {
      return res.status(400).json({ success: false, error: 'Phone number and recovery passphrase are required.' });
    }

    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = `+91${formattedPhone}`;
      } else {
        return res.status(400).json({ success: false, error: 'Invalid phone number format.' });
      }
    }

    // Query Firestore directly for the user
    const firestoreUser = await findUserByPhoneInFirestore(formattedPhone);

    if (!firestoreUser || !firestoreUser.passphraseHash) {
      return res.status(400).json({ success: false, error: 'Invalid phone number or recovery passphrase.' });
    }

    const isMatch = await bcrypt.compare(passphrase.trim().toUpperCase(), firestoreUser.passphraseHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid phone number or recovery passphrase.' });
    }

    // Generate short-lived reset token (valid for 10 minutes)
    const resetToken = jwt.sign(
      { userId: firestoreUser.id, phoneNumber: firestoreUser.phoneNumber, role: firestoreUser.role, purpose: 'PASSWORD_RESET' },
      RESET_TOKEN_SECRET,
      { expiresIn: '10m' }
    );

    return res.status(200).json({
      success: true,
      data: { resetToken },
    });
  } catch (error: any) {
    console.error('[Verify Passphrase Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Passphrase verification failed.' });
  }
});

// 5. Forgot Password - Reset with Token
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, error: 'Reset token and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    // Verify reset token
    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, RESET_TOKEN_SECRET);
    } catch (jwtErr) {
      return res.status(400).json({ success: false, error: 'Invalid or expired password reset token.' });
    }

    if (decoded.purpose !== 'PASSWORD_RESET') {
      return res.status(400).json({ success: false, error: 'Invalid reset token purpose.' });
    }

    const userId = decoded.userId;
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Ensure user is created/updated in SQLite first (since we might have cleaned up or aligned them)
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      if (!db) {
        return res.status(500).json({ success: false, error: 'Firebase database is not initialized.' });
      }
      // Query Firestore to get user details to sync back to SQLite
      const collName = decoded.role === 'STUDENT' ? 'students' : (decoded.role === 'TEACHER' ? 'teachers' : 'admin');
      const firestoreDoc = await db.collection(collName).doc(userId).get();
      if (firestoreDoc.exists) {
        const fData = firestoreDoc.data()!;
        user = await prisma.user.create({
          data: {
            id: userId,
            name: fData.name,
            email: fData.email || null,
            role: decoded.role,
            firstLogin: false,
            stream: fData.stream || null,
            class: fData.class || null,
            faculty: fData.faculty || null,
            school: fData.school || null,
          }
        });
      } else {
        return res.status(404).json({ success: false, error: 'User not found in Firestore.' });
      }
    } else {
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          firstLogin: false,
        },
      });
    }

    // Write to AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET',
        userId: user.id,
        actorId: userId,
        details: `Password reset successfully via recovery passphrase.`,
      },
    });

    // Sync updated user and new passwordHash to Firestore
    await syncUserToFirestore(user, {
      phoneNumber: decoded.phoneNumber,
      passwordHash
    });

    return res.status(200).json({
      success: true,
      data: { message: 'Password has been reset successfully.' },
    });
  } catch (error: any) {
    console.error('[Reset Password Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Password reset failed.' });
  }
});

// 6. Refresh Token
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, error: 'Refresh token is required' });
  }

  jwt.verify(refreshToken, REFRESH_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid refresh token' });
    }

    const payload = decoded as { id: string; phoneNumber: string; role: string };
    const accessToken = jwt.sign(
      { id: payload.id, phoneNumber: payload.phoneNumber, role: payload.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      data: { accessToken },
    });
  });
});

export default router;
