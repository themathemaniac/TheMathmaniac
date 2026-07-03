"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
// Setup upload directory
const uploadDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
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
        const whereClause = {};
        if (courseId) {
            whereClause.courseId = String(courseId);
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
        const isTeacher = userRole === 'TEACHER' || userRole === 'ADMIN';
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
        const materialsWithAccess = materials.map((mat) => {
            const isAccessible = isTeacher || mat.course.price === 0 || purchasedCourseIds.includes(mat.courseId);
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
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        const material = await db_1.default.studyMaterial.create({
            data: {
                courseId,
                title,
                type,
                fileSize: req.file.size,
                fileUrl,
            },
        });
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
            // Try to delete old file
            try {
                const oldFilename = existingMaterial.fileUrl.split('/uploads/')[1];
                if (oldFilename) {
                    const oldFilePath = path_1.default.join(uploadDir, oldFilename);
                    if (fs_1.default.existsSync(oldFilePath)) {
                        fs_1.default.unlinkSync(oldFilePath);
                    }
                }
            }
            catch (err) {
                console.error('Error deleting old file:', err);
            }
            updateData.fileSize = req.file.size;
            updateData.fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
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
// 4. Delete Study Material (Unlinks file and deletes DB record)
router.delete('/:id', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const existingMaterial = await db_1.default.studyMaterial.findUnique({
            where: { id },
        });
        if (!existingMaterial) {
            return res.status(404).json({ success: false, error: 'Study material not found' });
        }
        // Delete file from disk
        try {
            const filename = existingMaterial.fileUrl.split('/uploads/')[1];
            if (filename) {
                const filePath = path_1.default.join(uploadDir, filename);
                if (fs_1.default.existsSync(filePath)) {
                    fs_1.default.unlinkSync(filePath);
                }
            }
        }
        catch (err) {
            console.error('Error deleting file:', err);
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
exports.default = router;
