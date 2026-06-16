import { Router, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mathemaniac_secret_key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'mathemaniac_refresh_key';

// Mock database store for pending SMS OTPs during development
// Key: phoneNumber, Value: OTP string
const pendingOtps: Record<string, string> = {};

function generateTokens(payload: { id: string; email: string; role: string }) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); // Extended for easy local testing
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

// 1. Send OTP
router.post('/otp/send', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    // Static OTP for dev/testing: 123456
    const mockOtp = '123456';
    pendingOtps[phoneNumber] = mockOtp;

    console.log(`[SMS-MOCK] Sending OTP ${mockOtp} to ${phoneNumber}`);
    return res.status(200).json({
      success: true,
      data: { message: 'OTP sent successfully (Use 123456 for testing)' },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Verify OTP (Handles both Login & Instant Signup)
router.post('/otp/verify', async (req, res) => {
  try {
    const { phoneNumber, code, name, role } = req.body;
    if (!phoneNumber || !code) {
      return res.status(400).json({ success: false, error: 'Phone number and code are required' });
    }

    const savedOtp = pendingOtps[phoneNumber];
    if (code !== '123456' && savedOtp !== code) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    // Clear OTP
    delete pendingOtps[phoneNumber];

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      // Auto register student/teacher
      const fallbackEmail = `user_${Date.now()}@synapseedutech.in`;
      user = await prisma.user.create({
        data: {
          name: name || (role === 'TEACHER' ? 'Mathemaniac Teacher' : 'Mathemaniac Student'),
          email: fallbackEmail,
          phoneNumber,
          role: role || 'STUDENT',
        },
      });

      // Seed immediate default notification
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Welcome to Mathemaniac!',
          body: 'Thanks for signing up. Start exploring courses and attempting integration quizzes now!',
        },
      });
    } else if (role && user.role !== role) {
      // Dynamic role update for ease of testing student/teacher switching
      user = await prisma.user.update({
        where: { phoneNumber },
        data: { role },
      });
    }

    const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });
    return res.status(200).json({
      success: true,
      data: {
        ...tokens,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Signup (Standard Email registration)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, phoneNumber, password, role } = req.body;
    if (!name || !email || !phoneNumber || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phoneNumber }],
      },
    });

    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email or Phone number already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phoneNumber,
        passwordHash,
        role: role || 'STUDENT',
      },
    });

    // Auto-purchase Calculus course for immediate onboarding test ease
    const calculusCourse = await prisma.course.findFirst({
      where: { title: { contains: 'Calculus' } },
    });
    if (calculusCourse) {
      await prisma.purchase.create({
        data: {
          userId: user.id,
          courseId: calculusCourse.id,
          amount: calculusCourse.price,
          status: 'SUCCESS',
          razorpayOrderId: `order_auto_${user.id.substring(0, 8)}`,
        },
      });
    }

    const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });
    return res.status(201).json({
      success: true,
      data: {
        ...tokens,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Login (Standard Email login)
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Dynamic role update for ease of testing student/teacher switching
    if (role && user.role !== role) {
      user = await prisma.user.update({
        where: { email },
        data: { role },
      });
    }

    const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });
    return res.status(200).json({
      success: true,
      data: {
        ...tokens,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Mock Google Login
router.post('/google', async (req, res) => {
  try {
    const { email, name, googleId, photoUrl } = req.body;
    if (!email || !googleId) {
      return res.status(400).json({ success: false, error: 'Email and Google ID are required' });
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create user
      user = await prisma.user.create({
        data: {
          name: name || 'Google User',
          email,
          phoneNumber: `google_${googleId.substring(0, 10)}`, // Placeholder phone
          googleId,
          role: 'STUDENT',
        },
      });
    } else if (!user.googleId) {
      // Link googleId
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });
    }

    const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });
    return res.status(200).json({
      success: true,
      data: {
        ...tokens,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
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

    const payload = decoded as { id: string; email: string; role: string };
    const accessToken = jwt.sign(
      { id: payload.id, email: payload.email, role: payload.role },
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
