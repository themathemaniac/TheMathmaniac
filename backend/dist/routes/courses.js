"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const jwt = __importStar(require("jsonwebtoken"));
const auth_1 = require("../middleware/auth");
const notifications_1 = require("../utils/notifications");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'mathemaniac_secret_key';
// Helper to check token optionally and return full user info
function getOptionalUserInfo(authHeader) {
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            return decoded;
        }
        catch (e) {
            return null;
        }
    }
    return null;
}
// 1. Get Categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await db_1.default.courseCategory.findMany();
        return res.status(200).json({ success: true, data: categories });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 2. Get Courses (Supports search, category filters, and limit)
router.get('/', async (req, res) => {
    try {
        const { category, search, assigned } = req.query;
        const whereClause = {};
        if (category) {
            whereClause.category = { slug: String(category) };
        }
        if (search) {
            whereClause.OR = [
                { title: { contains: String(search), mode: 'insensitive' } },
                { description: { contains: String(search), mode: 'insensitive' } },
            ];
        }
        // Always check if current user purchased these courses
        const userInfo = getOptionalUserInfo(req.headers.authorization);
        const userId = userInfo?.id;
        const userRole = userInfo?.role;
        if (assigned === 'true' && userId) {
            whereClause.teachers = {
                some: { userId: userId }
            };
        }
        const courses = await db_1.default.course.findMany({
            where: whereClause,
            include: {
                category: true,
                teachers: {
                    include: {
                        user: { select: { name: true } }
                    }
                },
                _count: {
                    select: { lectures: true },
                },
            },
        });
        let purchasedCourseIds = [];
        if (userId) {
            if (userRole === 'ADMIN' || userRole === 'TEACHER') {
                purchasedCourseIds = courses.map((c) => c.id);
            }
            else {
                const purchases = await db_1.default.purchase.findMany({
                    where: {
                        userId: userId,
                        status: 'SUCCESS',
                    },
                    select: {
                        courseId: true,
                    },
                });
                purchasedCourseIds = purchases.map((p) => p.courseId);
            }
        }
        const coursesWithPurchaseInfo = courses.map((course) => ({
            ...course,
            isPurchased: userId ? purchasedCourseIds.includes(course.id) : false,
            lectureCount: course._count.lectures,
        }));
        return res.status(200).json({ success: true, data: coursesWithPurchaseInfo });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 3. Get Course Details by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userInfo = getOptionalUserInfo(req.headers.authorization);
        const userId = userInfo?.id;
        const userRole = userInfo?.role;
        const course = await db_1.default.course.findUnique({
            where: { id },
            include: {
                category: true,
                teachers: {
                    include: {
                        user: {
                            select: { id: true, name: true, subjects: true }
                        }
                    }
                },
                lectures: {
                    orderBy: { sortOrder: 'asc' },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        duration: true,
                        sortOrder: true,
                    },
                },
                _count: {
                    select: { lectures: true },
                },
            },
        });
        if (!course) {
            return res.status(404).json({ success: false, error: 'Course not found' });
        }
        // Determine purchase status
        let isPurchased = false;
        let progressList = [];
        if (userId) {
            if (userRole === 'ADMIN' || userRole === 'TEACHER') {
                isPurchased = true;
            }
            else {
                const purchase = await db_1.default.purchase.findFirst({
                    where: {
                        userId,
                        courseId: id,
                        status: 'SUCCESS',
                    },
                });
                isPurchased = !!purchase;
            }
            // Fetch progress for this user on this course's lectures
            progressList = await db_1.default.lectureProgress.findMany({
                where: {
                    userId,
                    lecture: { courseId: id },
                },
            });
        }
        // Return detailed course, embedding public details + outline
        return res.status(200).json({
            success: true,
            data: {
                ...course,
                isPurchased,
                learningOutcomes: JSON.parse(course.learningOutcomes || '[]'),
                lectureCount: course._count.lectures,
                lectures: course.lectures.map((lecture) => {
                    const progress = progressList.find((p) => p.lectureId === lecture.id);
                    return {
                        ...lecture,
                        lastPosition: progress ? progress.lastPosition : 0,
                        completed: progress ? progress.completed : false,
                    };
                }),
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 4. Update Course Theme (Teacher, Admin, Superuser)
router.put('/:id/theme', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const { thumbnailUrl } = req.body;
        if (!thumbnailUrl) {
            return res.status(400).json({ success: false, error: 'Thumbnail URL is required' });
        }
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const userPhone = req.user?.phoneNumber;
        if (!userId || !userRole) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // Superusers allow
        const isSuperuser = userPhone === '+917980357754' || userPhone === '+919831754957';
        if (!isSuperuser && userRole !== 'ADMIN' && userRole !== 'TEACHER') {
            return res.status(403).json({ success: false, error: 'Access Denied: Must be a teacher or admin.' });
        }
        // Check if course exists
        const course = await db_1.default.course.findUnique({
            where: { id },
            include: {
                teachers: true
            }
        });
        if (!course) {
            return res.status(404).json({ success: false, error: 'Course not found' });
        }
        // If teacher, check if they are assigned to this course
        if (!isSuperuser && userRole === 'TEACHER') {
            const isAssigned = course.teachers.some((t) => t.userId === userId);
            if (!isAssigned) {
                return res.status(403).json({ success: false, error: 'Access Denied: You are not assigned to this course.' });
            }
        }
        // Update the course
        await db_1.default.course.update({
            where: { id },
            data: { thumbnailUrl }
        });
        return res.status(200).json({ success: true, message: 'Theme updated successfully' });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 5. Get Course Students (Teacher/Admin)
router.get('/:id/students', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const userRole = req.user?.role;
        const isSuperuser = req.user?.phoneNumber === '+917980357754' || req.user?.phoneNumber === '+919831754957';
        if (userRole !== 'TEACHER' && userRole !== 'ADMIN' && !isSuperuser) {
            return res.status(403).json({ success: false, error: 'Access Denied' });
        }
        // Find all successful purchases for this course
        const purchases = await db_1.default.purchase.findMany({
            where: { courseId: id, status: 'SUCCESS' },
            include: {
                user: {
                    select: { id: true, name: true, email: true, school: true, stream: true }
                }
            }
        });
        const students = purchases.map(p => p.user);
        return res.status(200).json({ success: true, data: students });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 6. Get Course Announcements
router.get('/:id/announcements', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const isTeacher = userRole === 'TEACHER' || userRole === 'ADMIN' || userRole === 'SUPERUSER';
        if (!isTeacher && userId) {
            const course = await db_1.default.course.findUnique({ where: { id } });
            if (course?.price !== 0) {
                const purchase = await db_1.default.purchase.findFirst({
                    where: { userId, courseId: id, status: 'SUCCESS' }
                });
                if (!purchase) {
                    return res.status(200).json({ success: true, data: [] });
                }
            }
        }
        const announcements = await db_1.default.announcement.findMany({
            where: { courseId: id },
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
            orderBy: { createdAt: 'desc' }
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
// 7. Create Course Announcement (Teacher/Admin)
router.post('/:id/announcements', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;
        const userRole = req.user?.role;
        const isSuperuser = req.user?.phoneNumber === '+917980357754' || req.user?.phoneNumber === '+919831754957';
        if (userRole !== 'TEACHER' && userRole !== 'ADMIN' && !isSuperuser) {
            return res.status(403).json({ success: false, error: 'Access Denied' });
        }
        if (!title || !content) {
            return res.status(400).json({ success: false, error: 'Title and content are required' });
        }
        // Look up the name of the user who is posting the announcement
        const user = await db_1.default.user.findUnique({
            where: { id: req.user?.id },
            select: { name: true }
        });
        const authorName = user?.name || 'Instructor';
        const announcement = await db_1.default.announcement.create({
            data: {
                title,
                content,
                courseId: id,
                authorName
            }
        });
        // Notify all students enrolled in the course via push notifications
        const purchases = await db_1.default.purchase.findMany({
            where: { courseId: id, status: 'SUCCESS' },
            select: { userId: true },
        });
        for (const purchase of purchases) {
            (0, notifications_1.createNotificationAndPush)(purchase.userId, `New Announcement: ${title} 📢`, content).catch((e) => console.error('[Announcement Push Error]', e));
        }
        return res.status(201).json({ success: true, data: announcement });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 8. Delete Course Announcement (Teacher/Admin)
router.delete('/:id/announcements/:announcementId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id, announcementId } = req.params;
        const userRole = req.user?.role;
        const isSuperuser = req.user?.phoneNumber === '+917980357754' || req.user?.phoneNumber === '+919831754957';
        if (userRole !== 'TEACHER' && userRole !== 'ADMIN' && !isSuperuser) {
            return res.status(403).json({ success: false, error: 'Access Denied' });
        }
        await db_1.default.announcement.delete({
            where: { id: announcementId }
        });
        return res.status(200).json({ success: true, message: 'Announcement deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
