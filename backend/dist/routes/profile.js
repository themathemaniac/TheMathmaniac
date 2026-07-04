"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// 1. Get User Profile Details & Analytics Summary
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const user = await db_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                stream: true,
                class: true,
                faculty: true,
                school: true,
                createdAt: true,
            },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const userWithPhone = {
            ...user,
            phoneNumber: req.user?.phoneNumber || '',
        };
        // Performance numbers
        let stats = {};
        if (user.role === 'TEACHER' || user.role === 'ADMIN') {
            const totalStudents = await db_1.default.user.count({
                where: { role: 'STUDENT' },
            });
            const totalCourses = await db_1.default.course.count();
            const totalTests = await db_1.default.test.count();
            const totalMaterials = await db_1.default.studyMaterial.count();
            // Aggregate teaching hours
            const teacherAttendance = await db_1.default.teacherAttendance.findMany({
                where: { userId },
                select: { teachingHours: true }
            });
            const teachingHoursSum = teacherAttendance.reduce((acc, row) => acc + (row.teachingHours || 0), 0);
            // Count unique assigned courses (batches)
            const batchesManaged = await db_1.default.courseTeacher.count({
                where: { userId }
            });
            stats = {
                totalStudents,
                totalCourses,
                totalTests,
                totalMaterials,
                teachingHours: Math.round(teachingHoursSum * 10) / 10,
                batchesManaged,
            };
        }
        else {
            const totalPurchased = await db_1.default.purchase.count({
                where: { userId, status: 'SUCCESS' },
            });
            const completedProgress = await db_1.default.lectureProgress.count({
                where: { userId, completed: true },
            });
            const testResults = await db_1.default.result.findMany({
                where: { userId },
                select: { score: true, accuracy: true, test: { select: { totalMarks: true } } },
            });
            const totalTestsAttempted = testResults.length;
            const averageAccuracy = totalTestsAttempted > 0
                ? testResults.reduce((acc, row) => acc + row.accuracy, 0) / totalTestsAttempted
                : 0;
            stats = {
                purchasedCoursesCount: totalPurchased,
                completedLecturesCount: completedProgress,
                testsAttemptedCount: totalTestsAttempted,
                averageTestAccuracy: Math.round(averageAccuracy),
            };
        }
        let feeStatus = {
            hasPendingPayment: false,
            unpaidCourses: []
        };
        if (user.role === 'STUDENT') {
            const now = new Date();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const currentMonth = `${now.getFullYear()}-${mm}`;
            const purchases = await db_1.default.purchase.findMany({
                where: { userId, status: 'SUCCESS' },
                include: { course: true }
            });
            const unpaid = [];
            for (const purchase of purchases) {
                const payment = await db_1.default.feePayment.findFirst({
                    where: {
                        userId,
                        courseId: purchase.courseId,
                        month: currentMonth,
                        status: 'SUCCESS'
                    }
                });
                if (!payment) {
                    unpaid.push(purchase.course.title);
                }
            }
            if (unpaid.length > 0) {
                feeStatus = {
                    hasPendingPayment: true,
                    unpaidCourses: unpaid
                };
            }
        }
        return res.status(200).json({
            success: true,
            data: {
                profile: userWithPhone,
                stats,
                feeStatus,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 2. Get Purchased Courses list
router.get('/courses', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const purchases = await db_1.default.purchase.findMany({
            where: {
                userId,
                status: 'SUCCESS',
            },
            include: {
                course: {
                    include: {
                        _count: {
                            select: { lectures: true },
                        },
                    },
                },
            },
        });
        const courseList = purchases.map((p) => {
            const course = p.course;
            return {
                id: course.id,
                title: course.title,
                description: course.description,
                thumbnailUrl: course.thumbnailUrl,
                instructorName: course.instructorName,
                lectureCount: course._count.lectures,
            };
        });
        return res.status(200).json({ success: true, data: courseList });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 3. Get Announcements Feed (For Student Purchased Batches)
router.get('/announcements', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // Get purchased courses
        const purchases = await db_1.default.purchase.findMany({
            where: {
                userId,
                status: 'SUCCESS',
            },
            select: {
                courseId: true,
            },
        });
        const purchasedCourseIds = purchases.map((p) => p.courseId);
        const announcements = await db_1.default.announcement.findMany({
            where: {
                courseId: { in: purchasedCourseIds }
            },
            include: {
                course: {
                    include: {
                        teachers: {
                            include: {
                                user: {
                                    select: { name: true }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 15,
        });
        const mapped = announcements.map((announce) => {
            const courseTeachers = announce.course?.teachers || [];
            const fallbackTeacher = courseTeachers.length > 0 ? courseTeachers[0].user?.name : 'Teacher';
            return {
                ...announce,
                authorName: announce.authorName || announce.course?.instructorName || fallbackTeacher
            };
        });
        return res.status(200).json({ success: true, data: mapped });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 4. Get User Notifications
router.get('/notifications', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const notifications = await db_1.default.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        return res.status(200).json({ success: true, data: notifications });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 5. Mark Notifications as Read
router.post('/notifications/read-all', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        await db_1.default.notification.updateMany({
            where: { userId, read: false },
            data: { read: true },
        });
        return res.status(200).json({ success: true, data: { message: 'All notifications marked as read' } });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
