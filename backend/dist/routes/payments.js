"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const SUPERUSER_PHONES = ['+917980357754', '+919831754957'];
// 1. Manually log/register student payments (Admin/Superuser only)
router.post('/admin/register', auth_1.authenticateJWT, async (req, res) => {
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
        let fee = await db_1.default.feePayment.findFirst({
            where: { userId: studentId, courseId: courseId || null, month },
        });
        if (fee) {
            fee = await db_1.default.feePayment.update({
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
        }
        else {
            fee = await db_1.default.feePayment.create({
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
        const course = courseId ? await db_1.default.course.findUnique({ where: { id: courseId } }) : null;
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
        await db_1.default.notification.create({
            data: {
                userId: studentId,
                title: 'Fee Payment Registered 🧾',
                body: bodyText,
            },
        });
        return res.status(200).json({ success: true, data: fee });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 2. Fetch payment ledger history for student (or specific student if queried by admin)
router.get('/history', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const isSuperuser = req.user?.phoneNumber && SUPERUSER_PHONES.includes(req.user.phoneNumber);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        let targetUserId = userId;
        const queryStudentId = req.query.studentId;
        if (queryStudentId) {
            if (userRole !== 'ADMIN' && !isSuperuser) {
                return res.status(403).json({ success: false, error: 'Access Denied: Only Admins can query other students.' });
            }
            targetUserId = queryStudentId;
        }
        const fees = await db_1.default.feePayment.findMany({
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
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 3. GET Students List (For admin manual log dropdown)
router.get('/admin/students', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userRole = req.user?.role;
        const isSuperuser = req.user?.phoneNumber && SUPERUSER_PHONES.includes(req.user.phoneNumber);
        if (userRole !== 'ADMIN' && !isSuperuser) {
            return res.status(403).json({ success: false, error: 'Access Denied: Administrators or Superusers only.' });
        }
        const students = await db_1.default.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, name: true, phoneNumber: true },
            orderBy: { name: 'asc' },
        });
        return res.status(200).json({ success: true, data: students });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 4. Get all transactions/payments history (Admin/Superuser only)
router.get('/admin/history', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userRole = req.user?.role;
        const isSuperuser = req.user?.phoneNumber && SUPERUSER_PHONES.includes(req.user.phoneNumber);
        if (userRole !== 'ADMIN' && !isSuperuser) {
            return res.status(403).json({ success: false, error: 'Access Denied: Administrators or Superusers only.' });
        }
        const payments = await db_1.default.feePayment.findMany({
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
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
