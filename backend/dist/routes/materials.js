"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const notifications_1 = require("../utils/notifications");
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
// Setup upload directory
const uploadDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        }
        else {
            cb(new Error('Only PDF files are allowed!'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});
// 1. Get Study Materials (Supports courseId filtering, requires auth)
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { courseId } = req.query;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const isTeacher = userRole === 'TEACHER' || userRole === 'ADMIN' || userRole === 'SUPERUSER';
        let purchasedCourseIds = [];
        if (userId && !isTeacher) {
            const purchases = await db_1.default.purchase.findMany({
                where: {
                    userId,
                    status: 'SUCCESS',
                },
                select: {
                    courseId: true,
                },
            });
            purchasedCourseIds = purchases.map((p) => p.courseId);
        }
        const whereClause = {};
        if (courseId) {
            whereClause.courseId = String(courseId);
        }
        if (!isTeacher) {
            if (courseId) {
                if (!purchasedCourseIds.includes(String(courseId))) {
                    return res.status(200).json({ success: true, data: [] });
                }
            }
            else {
                whereClause.courseId = { in: purchasedCourseIds };
            }
        }
        const materials = await db_1.default.studyMaterial.findMany({
            where: whereClause,
            include: {
                course: {
                    select: { title: true, price: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const materialsWithAccess = materials.map((mat) => {
            const isAccessible = isTeacher || purchasedCourseIds.includes(mat.courseId);
            return {
                id: mat.id,
                courseId: mat.courseId,
                courseTitle: mat.course.title,
                title: mat.title,
                type: mat.type,
                fileSize: mat.fileSize,
                fileUrl: mat.fileUrl,
                isAccessible,
            };
        });
        return res.status(200).json({ success: true, data: materialsWithAccess });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 2. Create Study Material with PDF Upload (Requires Auth)
router.post('/', auth_1.authenticateJWT, upload.single('file'), async (req, res) => {
    try {
        const { title, type, courseId } = req.body;
        if (!title || !type || !courseId) {
            return res.status(400).json({ success: false, error: 'Title, type, and courseId are required' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'A PDF file is required' });
        }
        // Check if course exists
        const course = await db_1.default.course.findUnique({
            where: { id: courseId },
        });
        if (!course) {
            return res.status(404).json({ success: false, error: 'Course not found' });
        }
        const material = await db_1.default.studyMaterial.create({
            data: {
                courseId,
                title,
                type,
                fileSize: req.file.size,
                fileData: req.file.buffer,
                fileUrl: '',
            },
        });
        const fileUrl = `${req.protocol}://${req.get('host')}/api/v1/materials/${material.id}/download`;
        await db_1.default.studyMaterial.update({
            where: { id: material.id },
            data: { fileUrl },
        });
        material.fileUrl = fileUrl;
        // Notify all students who purchased the course
        const purchases = await db_1.default.purchase.findMany({
            where: { courseId, status: 'SUCCESS' },
            select: { userId: true },
        });
        for (const purchase of purchases) {
            (0, notifications_1.createNotificationAndPush)(purchase.userId, `New Study Material: ${course.title} 📚`, `New study material "${title}" (${type}) has been uploaded.`).catch((e) => console.error('[Material Notif Error]', e));
        }
        return res.status(201).json({ success: true, data: material });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 3. Update Study Material (Supports PDF Replacement and text fields)
router.put('/:id', auth_1.authenticateJWT, upload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, type, courseId } = req.body;
        const existingMaterial = await db_1.default.studyMaterial.findUnique({
            where: { id },
        });
        if (!existingMaterial) {
            return res.status(404).json({ success: false, error: 'Study material not found' });
        }
        const updateData = {};
        if (title)
            updateData.title = title;
        if (type)
            updateData.type = type;
        if (courseId) {
            const course = await db_1.default.course.findUnique({ where: { id: courseId } });
            if (!course) {
                return res.status(404).json({ success: false, error: 'Course not found' });
            }
            updateData.courseId = courseId;
        }
        // If new file is uploaded
        if (req.file) {
            updateData.fileSize = req.file.size;
            updateData.fileData = req.file.buffer;
        }
        const updatedMaterial = await db_1.default.studyMaterial.update({
            where: { id },
            data: updateData,
        });
        return res.status(200).json({ success: true, data: updatedMaterial });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 4. Delete Study Material (Deletes DB record along with binary data)
router.delete('/:id', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const existingMaterial = await db_1.default.studyMaterial.findUnique({
            where: { id },
        });
        if (!existingMaterial) {
            return res.status(404).json({ success: false, error: 'Study material not found' });
        }
        await db_1.default.studyMaterial.delete({
            where: { id },
        });
        return res.status(200).json({ success: true, data: { message: 'Study material deleted successfully' } });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 5. Download Study Material PDF
router.get('/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        const material = await db_1.default.studyMaterial.findUnique({
            where: { id },
            select: { fileData: true, title: true, type: true }
        });
        if (!material || !material.fileData) {
            return res.status(404).send('File not found');
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(material.title)}.pdf"`);
        res.send(material.fileData);
    }
    catch (error) {
        console.error('Download error:', error);
        res.status(500).send('Error downloading file');
    }
});
exports.default = router;
