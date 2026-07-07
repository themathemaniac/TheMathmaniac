import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { createNotificationAndPush } from '../utils/notifications';

const router = Router();

const SUPERUSER_PHONES = ['+917980357754', '+919831754957'];

// 1. Manually log/register student payments (Admin/Superuser only)
router.post('/admin/register', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const isSuperuser = req.user?.phoneNumber && SUPERUSER_PHONES.includes(req.user.phoneNumber);

    if (userRole !== 'ADMIN' && !isSuperuser) {
      return res.status(403).json({ success: false, error: 'Access Denied: Administrators or Superusers only.' });
    }

    const { studentId, courseId, month, amount, paymentMode, isNewAdmission, admissionFee, fine } = req.body;

    if (!studentId || !month || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required fields: studentId, month, amount' });
    }

    const tuitionAmount = parseFloat(amount) || 0;
    const admFee = isNewAdmission ? (parseFloat(admissionFee) || 0) : 0;
    const fineAmount = parseFloat(fine) || 0;
    const totalAmount = tuitionAmount + admFee + fineAmount;

    const amountInPaisa = Math.round(tuitionAmount * 100);
    const fineInPaisa = Math.round(fineAmount * 100);
    const totalInPaisa = Math.round(totalAmount * 100);

    const noteText = isNewAdmission
      ? `New Admission (Admission Fee: ₹${admFee}${fineAmount > 0 ? `, Late Fee: ₹${fineAmount}` : ''})`
      : fineAmount > 0 ? `Late Fee: ₹${fineAmount}` : 'Offline payment recorded by admin';

    // Look for existing record to update, otherwise create new
    let fee = await prisma.feePayment.findFirst({
      where: { userId: studentId, courseId: courseId || null, month },
    });

    if (fee) {
      fee = await prisma.feePayment.update({
        where: { id: fee.id },
        data: {
          status: 'SUCCESS',
          amount: amountInPaisa,
          fine: fineInPaisa,
          totalAmount: totalInPaisa,
          paymentMode: paymentMode || 'OFFLINE_CASH',
          transactionNote: noteText,
          paidAt: new Date(),
        },
      });
    } else {
      fee = await prisma.feePayment.create({
        data: {
          userId: studentId,
          courseId: courseId || null,
          month,
          amount: amountInPaisa,
          fine: fineInPaisa,
          totalAmount: totalInPaisa,
          status: 'SUCCESS',
          paymentMode: paymentMode || 'OFFLINE_CASH',
          transactionNote: noteText,
          paidAt: new Date(),
        },
      });
    }

    const course = courseId ? await prisma.course.findUnique({ where: { id: courseId } }) : null;
    const formattedTotalAmount = (totalInPaisa / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });

    const bodyText = isNewAdmission
      ? `A payment of ${formattedTotalAmount} (including Admission Fee of ₹${admFee}${fineAmount > 0 ? ` & Late Fee of ₹${fineAmount}` : ''}) for ${course?.title || 'Monthly Fee'} (${month}) has been successfully logged by the administrator.`
      : fineAmount > 0
        ? `A payment of ${formattedTotalAmount} (including Late Fee of ₹${fineAmount}) for ${course?.title || 'Monthly Fee'} (${month}) has been successfully logged by the administrator.`
        : `A payment of ${formattedTotalAmount} for ${course?.title || 'Monthly Fee'} (${month}) has been successfully logged by the administrator.`;

    await createNotificationAndPush(
      studentId,
      'Fee Payment Registered 🧾',
      bodyText
    );

    return res.status(200).json({ success: true, data: fee });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Fetch payment ledger history for student (or specific student if queried by admin)
router.get('/history', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const isSuperuser = req.user?.phoneNumber && SUPERUSER_PHONES.includes(req.user.phoneNumber);

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    let targetUserId = userId;
    const queryStudentId = req.query.studentId as string;

    if (queryStudentId) {
      if (userRole !== 'ADMIN' && !isSuperuser) {
        return res.status(403).json({ success: false, error: 'Access Denied: Only Admins can query other students.' });
      }
      targetUserId = queryStudentId;
    }

    const fees = await prisma.feePayment.findMany({
      where: {
        userId: targetUserId,
        status: 'SUCCESS',
      },
      include: {
        course: {
          select: { title: true },
        },
      },
      orderBy: { month: 'desc' },
    });

    return res.status(200).json({ success: true, data: fees });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. GET Students List (For admin manual log dropdown)
router.get('/admin/students', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const isSuperuser = req.user?.phoneNumber && SUPERUSER_PHONES.includes(req.user.phoneNumber);
    if (userRole !== 'ADMIN' && !isSuperuser) {
      return res.status(403).json({ success: false, error: 'Access Denied: Administrators or Superusers only.' });
    }

    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: { id: true, name: true, phoneNumber: true },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({ success: true, data: students });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Get all transactions/payments history (Admin/Superuser only)
router.get('/admin/history', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const isSuperuser = req.user?.phoneNumber && SUPERUSER_PHONES.includes(req.user.phoneNumber);

    if (userRole !== 'ADMIN' && !isSuperuser) {
      return res.status(403).json({ success: false, error: 'Access Denied: Administrators or Superusers only.' });
    }
    const payments = await prisma.feePayment.findMany({
      where: {
        status: 'SUCCESS',
        courseId: { not: null },
        course: {
          category: {
            slug: {
              notIn: ['iit-jee', 'neet', 'engg-math', 'olympiad-foundation']
            }
          }
        }
      },
      include: {
        user: {
          select: { name: true, phoneNumber: true },
        },
        course: {
          select: { title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: payments });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
