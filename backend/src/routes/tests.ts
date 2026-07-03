import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

// Setup upload directory
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// 1. Get Tests List (Teachers see published/unpublished, students see published only)
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const isTeacher = userRole === 'TEACHER' || userRole === 'ADMIN';
    const userId = req.user?.id;

    let tests;
    if (isTeacher) {
      tests = await prisma.test.findMany({
        include: {
          course: {
            select: { title: true },
          },
        },
      });
    } else {
      // Find user's purchased/enrolled courses
      const purchases = await prisma.purchase.findMany({
        where: {
          userId,
          status: 'SUCCESS',
        },
        select: {
          courseId: true,
        },
      });
      const purchasedCourseIds = purchases.map((p) => p.courseId);

      tests = await prisma.test.findMany({
        where: {
          published: true,
          OR: [
            { courseId: null },
            { courseId: { in: purchasedCourseIds } }
          ]
        },
        include: {
          course: {
            select: { title: true },
          },
        },
      });
    }

    return res.status(200).json({ success: true, data: tests });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get Test Details (Hides correct answers)
router.get('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: {
              select: {
                id: true,
                text: true,
              },
            },
          },
        },
      },
    });

    if (!test) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }

    // Hide answers payload
    const safeQuestions = test.questions.map((q) => {
      const { numericalAnswer, explanation, ...rest } = q;
      return rest;
    });

    return res.status(200).json({
      success: true,
      data: {
        id: test.id,
        title: test.title,
        duration: test.duration,
        totalMarks: test.totalMarks,
        pdfUrl: test.pdfUrl,
        pdfSize: test.pdfSize,
        pdfName: test.pdfName,
        questions: safeQuestions,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Submit Test Answers & Calculate Scores
router.post('/:id/submit', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { answers } = req.body; // Array of { questionId: string, optionId?: string, numericalAnswer?: string }
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!test) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }

    let score = 0;
    let correctCount = 0;
    const feedbackPayload: any[] = [];

    // Calculate score
    for (const question of test.questions) {
      const userAnswer = answers.find((ans: any) => ans.questionId === question.id);
      let isCorrect = false;
      let selectedText = '';

      if (question.type === 'SINGLE_CORRECT') {
        const correctOption = question.options.find((opt) => opt.isCorrect);
        const selectedOption = question.options.find((opt) => opt.id === userAnswer?.optionId);
        selectedText = selectedOption ? selectedOption.text : '';

        if (userAnswer?.optionId && correctOption && userAnswer.optionId === correctOption.id) {
          isCorrect = true;
        }
      } else if (question.type === 'MULTIPLE_CORRECT') {
        // Multi-correct check: User options must match correct options exactly
        const correctOptionIds = question.options.filter((opt) => opt.isCorrect).map((opt) => opt.id);
        const userOptionIds = userAnswer?.optionIds || (userAnswer?.optionId ? [userAnswer.optionId] : []);

        const matchesAllCorrect = correctOptionIds.every((id) => userOptionIds.includes(id));
        const hasNoIncorrect = userOptionIds.every((id: string) => correctOptionIds.includes(id));

        isCorrect = matchesAllCorrect && hasNoIncorrect && correctOptionIds.length > 0;
        selectedText = question.options
          .filter((opt) => userOptionIds.includes(opt.id))
          .map((opt) => opt.text)
          .join(', ');
      } else if (question.type === 'NUMERICAL') {
        const userNum = String(userAnswer?.numericalAnswer || '').trim();
        const correctNum = String(question.numericalAnswer || '').trim();
        selectedText = userNum;

        if (userNum && correctNum && userNum === correctNum) {
          isCorrect = true;
        }
      }

      if (isCorrect) {
        score += question.marks;
        correctCount++;
      }

      feedbackPayload.push({
        questionId: question.id,
        text: question.text,
        type: question.type,
        userAnswer: selectedText,
        isCorrect,
        correctAnswer: question.type === 'NUMERICAL' 
          ? question.numericalAnswer 
          : question.options.filter((o) => o.isCorrect).map((o) => o.text).join(', '),
        explanation: question.explanation,
        marksAwarded: isCorrect ? question.marks : 0,
      });
    }

    const accuracy = test.questions.length > 0 ? (correctCount / test.questions.length) * 100 : 0;

    // Save result in DB
    const result = await prisma.result.create({
      data: {
        userId,
        testId: id,
        score,
        accuracy,
        answersPayload: JSON.stringify(feedbackPayload),
      },
    });

    // Calculate Rank relative to other results
    const resultsCount = await prisma.result.count({
      where: {
        testId: id,
        score: { gt: score },
      },
    });
    const rank = resultsCount + 1;

    return res.status(200).json({
      success: true,
      data: {
        resultId: result.id,
        score,
        totalMarks: test.totalMarks,
        accuracy,
        rank,
        feedback: feedbackPayload,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Get Leaderboard for a Test
router.get('/:id/leaderboard', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const rawLeaderboard = await prisma.result.findMany({
      where: { testId: id },
      orderBy: [
        { score: 'desc' },
        { accuracy: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 20,
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    // Group by user to show only their personal best result on the board
    const uniqueLeaderboard: any[] = [];
    const seenUsers = new Set<string>();

    for (const row of rawLeaderboard) {
      if (!seenUsers.has(row.userId)) {
        seenUsers.add(row.userId);
        uniqueLeaderboard.push({
          userId: row.userId,
          name: row.user.name,
          score: row.score,
          accuracy: row.accuracy,
          createdAt: row.createdAt,
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: uniqueLeaderboard,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Upload PDF Question Paper to Test (Requires Auth)
router.post('/:id/upload-pdf', authenticateJWT, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'A PDF file is required' });
    }

    const test = await prisma.test.findUnique({
      where: { id },
    });
    if (!test) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }

    // Try deleting old file if it exists
    if (test.pdfUrl) {
      try {
        const oldFilename = test.pdfUrl.split('/uploads/')[1];
        if (oldFilename) {
          const oldFilePath = path.join(uploadDir, oldFilename);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
      } catch (err) {
        console.error('Error deleting old test PDF:', err);
      }
    }

    const pdfUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    const updatedTest = await prisma.test.update({
      where: { id },
      data: {
        pdfUrl,
        pdfSize: req.file.size,
        pdfName: req.file.originalname,
      },
    });

    return res.status(200).json({ success: true, data: updatedTest });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Delete PDF Question Paper from Test (Requires Auth)
router.delete('/:id/pdf', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const test = await prisma.test.findUnique({
      where: { id },
    });
    if (!test) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }

    // Delete file from disk
    if (test.pdfUrl) {
      try {
        const filename = test.pdfUrl.split('/uploads/')[1];
        if (filename) {
          const filePath = path.join(uploadDir, filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (err) {
        console.error('Error deleting test PDF file:', err);
      }
    }

    const updatedTest = await prisma.test.update({
      where: { id },
      data: {
        pdfUrl: null,
        pdfSize: null,
        pdfName: null,
      },
    });

    return res.status(200).json({ success: true, data: updatedTest });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Create Test (Requires Auth - Teacher or Admin)
router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'TEACHER' && userRole !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Access Denied: Teacher or Administrator role required.' });
    }

    const { title, duration, totalMarks, courseId, published } = req.body;

    if (!title || duration === undefined || totalMarks === undefined) {
      return res.status(400).json({ success: false, error: 'Title, duration, and totalMarks are required.' });
    }

    // Verify courseId if provided
    if (courseId && courseId !== 'NONE') {
      const courseExists = await prisma.course.findUnique({ where: { id: courseId } });
      if (!courseExists) {
        return res.status(404).json({ success: false, error: 'Course not found.' });
      }
    }

    const test = await prisma.test.create({
      data: {
        title: title.trim(),
        duration: Number(duration),
        totalMarks: Number(totalMarks),
        courseId: (courseId && courseId !== 'NONE') ? courseId : null,
        published: published !== undefined ? Boolean(published) : false,
      },
    });

    return res.status(201).json({ success: true, data: test });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
