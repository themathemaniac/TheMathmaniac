"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// 1. Get Lecture Details (Includes video URL, requires purchase check)
router.get('/:id', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const lecture = await db_1.default.lecture.findUnique({
            where: { id },
            include: { course: true },
        });
        if (!lecture) {
            return res.status(404).json({ success: false, error: 'Lecture not found' });
        }
        // Fetch user progress
        const progress = await db_1.default.lectureProgress.findUnique({
            where: {
                userId_lectureId: { userId, lectureId: id },
            },
        });
        return res.status(200).json({
            success: true,
            data: {
                id: lecture.id,
                courseId: lecture.courseId,
                courseTitle: lecture.course.title,
                title: lecture.title,
                description: lecture.description,
                videoUrl: lecture.videoUrl,
                duration: lecture.duration,
                notesUrl: lecture.notesUrl,
                lastPosition: progress ? progress.lastPosition : 0,
                completed: progress ? progress.completed : false,
            },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// 2. Log / Update Lecture Progress
router.post('/:id/progress', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const { lastPosition, completed } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        if (lastPosition === undefined) {
            return res.status(400).json({ success: false, error: 'lastPosition is required' });
        }
        // Upsert the lecture progress log
        const progress = await db_1.default.lectureProgress.upsert({
            where: {
                userId_lectureId: { userId, lectureId: id },
            },
            update: {
                lastPosition: Number(lastPosition),
                completed: Boolean(completed),
            },
            create: {
                userId,
                lectureId: id,
                lastPosition: Number(lastPosition),
                completed: Boolean(completed),
            },
        });
        return res.status(200).json({ success: true, data: progress });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
