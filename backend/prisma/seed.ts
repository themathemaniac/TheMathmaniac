import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { db, isFirebaseEnabled } from '../src/config/firebase';

const prisma = new PrismaClient();

async function syncToFirestore(user: { id: string; name: string; phoneNumber: string; role: string; passwordHash: string | null; passphraseHash: string | null; firstLogin: boolean }) {
  if (isFirebaseEnabled && db) {
    try {
      let collectionName = 'students';
      if (user.role === 'TEACHER') {
        collectionName = 'teachers';
      } else if (user.role === 'ADMIN') {
        collectionName = 'admin';
      }
      await db.collection(collectionName).doc(user.id).set({
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
        passwordHash: user.passwordHash,
        passphraseHash: user.passphraseHash,
        firstLogin: user.firstLogin,
      }, { merge: true });
      console.log(`[Seed Firebase] Synced ${user.name} to Firestore collection "${collectionName}"`);
    } catch (err: any) {
      console.error(`[Seed Firebase Error] Failed to sync ${user.name}:`, err.message);
    }
  }
}

async function main() {
  console.log('Seeding database...');

  // Clean existing tables
  await prisma.notification.deleteMany({});
  await prisma.announcement.deleteMany({});
  await prisma.studyMaterial.deleteMany({});
  await prisma.result.deleteMany({});
  await prisma.questionOption.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.test.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.lectureProgress.deleteMany({});
  await prisma.lecture.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.courseCategory.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Seed Users (Student and Admin)
  const passwordHash = await bcrypt.hash('password123', 10);
  const studentPassphraseHash = await bcrypt.hash('STUDENT-RECOVERY-5555', 10);
  const adminPassphraseHash = await bcrypt.hash('ADMIN-RECOVERY-9999', 10);

  const testStudent = await prisma.user.create({
    data: {
      name: 'Rohan Dey',
      email: 'rohan@outlook.com',
      firstLogin: true,
      role: 'STUDENT',
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      id: '2fed78e3-fa1d-4b1c-8879-d246a603e16a', // Align with Firestore ID
      name: 'Mathemaniac Admin',
      firstLogin: false,
      role: 'ADMIN',
    },
  });

  await syncToFirestore({
    id: testStudent.id,
    name: testStudent.name,
    role: testStudent.role,
    firstLogin: testStudent.firstLogin,
    phoneNumber: '+919831754957',
    passwordHash,
    passphraseHash: studentPassphraseHash,
  });

  await syncToFirestore({
    id: adminUser.id,
    name: adminUser.name,
    role: adminUser.role,
    firstLogin: adminUser.firstLogin,
    phoneNumber: '+917890302020',
    passwordHash,
    passphraseHash: adminPassphraseHash,
  });

  console.log(`Users seeded: Student ID: ${testStudent.id}, Admin ID: ${adminUser.id}`);

  // 2. Seed Course Categories
  const categoryJee = await prisma.courseCategory.create({
    data: { name: 'IIT-JEE', slug: 'iit-jee' },
  });
  const categoryNeet = await prisma.courseCategory.create({
    data: { name: 'NEET', slug: 'neet' },
  });
  const categoryEngg = await prisma.courseCategory.create({
    data: { name: 'BTech & MTech Math', slug: 'engg-math' },
  });
  const categoryOlympiad = await prisma.courseCategory.create({
    data: { name: 'Olympiad & Foundation', slug: 'olympiad-foundation' },
  });

  console.log('Categories seeded.');

  // 3. Seed Courses
  const courseCalculus = await prisma.course.create({
    data: {
      title: 'IIT-JEE Advanced Mathematics - Calculus Masterclass',
      description: 'Master limits, continuity, differentiability, derivatives, and definite integration for IIT-JEE Advanced. Includes step-by-step video lessons, visual sheets, and chapter quizzes.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=600',
      price: 199900, // INR 1999.00 in Paisa
      categoryId: categoryJee.id,
      instructorName: 'Prof. S. Sen (IIT Kharagpur Alumnus)',
      learningOutcomes: JSON.stringify([
        'Understand graphical analysis of limits & continuity',
        'Solve complex derivatives using chain rule and implicit differentiation',
        'Master application of derivatives: maxima, minima, and rates of change',
        'Solve advanced integration problems with substitution and integration by parts',
      ]),
      published: true,
    },
  });

  const coursePhysics = await prisma.course.create({
    data: {
      title: 'NEET Physics Prep: Mechanics & Thermodynamics',
      description: 'A dedicated bootcamp explaining concepts, numerical shortcuts, and formula derivations for medical aspirants.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=600',
      price: 149900, // INR 1499.00 in Paisa
      categoryId: categoryNeet.id,
      instructorName: 'Dr. R. Banerjee',
      learningOutcomes: JSON.stringify([
        'Master kinematics & laws of motion with focus on NEET problems',
        'Solve work, power, and energy equations rapidly without calculation fatigue',
        'Visualise thermodynamics processes, Carnot engine, and gas laws',
      ]),
      published: true,
    },
  });

  const courseEnggMath = await prisma.course.create({
    data: {
      title: 'BTech Engineering Mathematics - Linear Algebra & Calculus',
      description: 'Comprehensive course covering matrices, eigenvalues, double integrals, and differential equations for engineering syllabus.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=600',
      price: 99900, // INR 999.00 in Paisa
      categoryId: categoryEngg.id,
      instructorName: 'Prof. A. Ray',
      learningOutcomes: JSON.stringify([
        'Find Rank, Inverse and Eigenvalues of any Matrix',
        'Solve linear ordinary differential equations of higher orders',
        'Evaluate multiple double/triple integration coordinates',
      ]),
      published: true,
    },
  });

  const courseOlympiad = await prisma.course.create({
    data: {
      title: 'Pre-RMO & IOQM Foundation Mathematics',
      description: 'Problem-solving tactics, number theory, geometry theorems, and combinatorics for school competitive exams.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1453733190148-c44698c26588?auto=format&fit=crop&q=80&w=600',
      price: 49900, // INR 499.00 in Paisa
      categoryId: categoryOlympiad.id,
      instructorName: 'S. K. Dey (Mathemaniac Founder)',
      learningOutcomes: JSON.stringify([
        'Master Modular Arithmetic and GCD properties',
        'Solve advanced visual geometry problems using properties of cyclic quadrilaterals',
        'Apply Pigeonhole Principle and Permutations in competitive setups',
      ]),
      published: true,
    },
  });

  console.log('Courses seeded.');

  // 4. Seed Lectures for Calculus Course
  const lecture1 = await prisma.lecture.create({
    data: {
      courseId: courseCalculus.id,
      title: 'Introduction to Functions & Graphical Transformations',
      description: 'Learn how to sketch graphs of polynomial, trigonometric, logarithmic, and absolute functions, and apply shifting rules.',
      videoUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', // Standard demo HLS URL
      duration: 900, // 15 mins
      sortOrder: 1,
      notesUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    },
  });

  const lecture2 = await prisma.lecture.create({
    data: {
      courseId: courseCalculus.id,
      title: 'Limits & Continuity: The Delta-Epsilon Definition',
      description: 'Understanding left-hand limits (LHL) and right-hand limits (RHL), continuous functions, and removable vs non-removable discontinuities.',
      videoUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
      duration: 1200, // 20 mins
      sortOrder: 2,
      notesUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    },
  });

  const lecture3 = await prisma.lecture.create({
    data: {
      courseId: courseCalculus.id,
      title: 'Understanding Derivatives & Slope of Tangents',
      description: 'Visualising the derivative as a slope of tangent, differentiability checks, and using standard differentiation formulas.',
      videoUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
      duration: 1500, // 25 mins
      sortOrder: 3,
      notesUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    },
  });

  const lecture4 = await prisma.lecture.create({
    data: {
      courseId: courseCalculus.id,
      title: 'Definite Integration & Fundamental Theorem of Calculus',
      description: 'Integral calculus from basic area summations to the second fundamental theorem and properties of definite integrals.',
      videoUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
      duration: 1800, // 30 mins
      sortOrder: 4,
      notesUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    },
  });

  console.log('Lectures seeded.');

  // 5. Seed Study Materials
  await prisma.studyMaterial.create({
    data: {
      courseId: courseCalculus.id,
      title: 'Calculus Complete Cheat Sheet & Formulas',
      type: 'FORMULA_SHEET',
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileSize: 150000,
    },
  });

  await prisma.studyMaterial.create({
    data: {
      courseId: courseCalculus.id,
      title: 'Limits & Differentiability Practice Problems Assignment',
      type: 'ASSIGNMENT',
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileSize: 420000,
    },
  });

  await prisma.studyMaterial.create({
    data: {
      courseId: courseOlympiad.id,
      title: 'IOQM Number Theory Practice Set',
      type: 'NOTES',
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileSize: 310000,
    },
  });

  console.log('Study Materials seeded.');

  // 6. Seed Tests & Questions
  const testCalculus = await prisma.test.create({
    data: {
      courseId: courseCalculus.id,
      title: 'Definite Integration & Limits Quiz',
      duration: 15, // 15 mins
      totalMarks: 30,
      published: true,
    },
  });

  // Question 1: Single Correct (10 Marks)
  const q1 = await prisma.question.create({
    data: {
      testId: testCalculus.id,
      text: 'Evaluate the definite integral of f(x) = sin(x) from 0 to pi/2.',
      type: 'SINGLE_CORRECT',
      marks: 10,
      explanation: 'The integral of sin(x) is -cos(x). Evaluating from 0 to pi/2: -cos(pi/2) - (-cos(0)) = 0 + 1 = 1.',
    },
  });

  await prisma.questionOption.createMany({
    data: [
      { questionId: q1.id, text: '0', isCorrect: false },
      { questionId: q1.id, text: '1', isCorrect: true },
      { questionId: q1.id, text: '-1', isCorrect: false },
      { questionId: q1.id, text: 'pi/2', isCorrect: false },
    ],
  });

  // Question 2: Multiple Correct (10 Marks)
  const q2 = await prisma.question.create({
    data: {
      testId: testCalculus.id,
      text: 'Identify which of the following functions are continuous for all real numbers x.',
      type: 'MULTIPLE_CORRECT',
      marks: 10,
      explanation: 'f(x) = sin(x) and f(x) = x^2 are continuous everywhere. g(x) = tan(x) is discontinuous at odd multiples of pi/2. h(x) = ln(x) is only defined for x > 0.',
    },
  });

  await prisma.questionOption.createMany({
    data: [
      { questionId: q2.id, text: 'f(x) = sin(x)', isCorrect: true },
      { questionId: q2.id, text: 'f(x) = x^2', isCorrect: true },
      { questionId: q2.id, text: 'f(x) = tan(x)', isCorrect: false },
      { questionId: q2.id, text: 'f(x) = ln(x)', isCorrect: false },
    ],
  });

  // Question 3: Numerical (10 Marks)
  await prisma.question.create({
    data: {
      testId: testCalculus.id,
      text: 'Calculate the value of the definite integral: \\int_{0}^{2} 3x^2 dx. Input integer answer.',
      type: 'NUMERICAL',
      numericalAnswer: '8',
      marks: 10,
      explanation: 'The integral of 3x^2 is x^3. Evaluating from 0 to 2 gives 2^3 - 0^3 = 8.',
    },
  });

  console.log('Tests and Questions seeded.');

  // 7. Seed Announcements
  await prisma.announcement.create({
    data: {
      title: 'Integration Core Cheat Sheet Released!',
      content: 'Hello Mathemaniacs! We have just uploaded a detailed sheet of Integration formulas and quick trigonometric substitution tips in the Study Materials section. Check it out now to prepare for the quiz!',
    },
  });

  await prisma.announcement.create({
    data: {
      title: 'Integration Online Mock Quiz this Sunday!',
      content: 'Gear up for the online Calculus quiz starting this Sunday at 10:00 AM. It consists of 3 questions (Single Correct, Multi-Correct, and Numerical Answer) with a 15-minute countdown. Leaderboard positions will be updated instantly.',
    },
  });

  console.log('Announcements seeded.');

  // 8. Seed Course Purchases for Rohan Dey (to have immediate access to Calculus)
  await prisma.purchase.create({
    data: {
      userId: testStudent.id,
      courseId: courseCalculus.id,
      amount: 199900,
      status: 'SUCCESS',
      razorpayOrderId: 'order_test_calculus_rohan',
      razorpayPaymentId: 'pay_test_calculus_rohan',
    },
  });

  // 9. Seed Lecture Progress for Rohan Dey
  await prisma.lectureProgress.create({
    data: {
      userId: testStudent.id,
      lectureId: lecture1.id,
      lastPosition: 900,
      completed: true,
    },
  });

  await prisma.lectureProgress.create({
    data: {
      userId: testStudent.id,
      lectureId: lecture2.id,
      lastPosition: 645,
      completed: false,
    },
  });

  // 10. Seed Notifications for Rohan
  await prisma.notification.create({
    data: {
      userId: testStudent.id,
      title: 'Welcome to Synapse EduTech!',
      body: 'Hi Rohan, explore your courses, download formula sheets, and take quizzes to boost your JEE preparation.',
      read: false,
    },
  });

  await prisma.notification.create({
    data: {
      userId: testStudent.id,
      title: 'Calculus Course Unlocked ⚡',
      body: 'Your purchase of IIT-JEE Advanced Mathematics - Calculus Masterclass was successful. Start watching Lecture 1 now!',
      read: true,
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
