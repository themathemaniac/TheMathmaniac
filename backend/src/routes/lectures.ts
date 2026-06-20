import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// 1. Get Lecture Details (Includes video URL, requires purchase check)
router.get('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const lecture = await prisma.lecture.findUnique({
      where: { id },
      include: { course: true },
    });

    if (!lecture) {
      return res.status(404).json({ success: false, error: 'Lecture not found' });
    }

    // Verify course is purchased
    const purchase = await prisma.purchase.findFirst({
      where: { userId, courseId: lecture.courseId, status: 'SUCCESS' },
    });

    if (!purchase && lecture.course.price > 0) {
      return res.status(403).json({ success: false, error: 'You must purchase this course to view this lecture' });
    }

    // Fetch user progress
    const progress = await prisma.lectureProgress.findUnique({
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
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Log / Update Lecture Progress
router.post('/:id/progress', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
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
    const progress = await prisma.lectureProgress.upsert({
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
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
