import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Removing sandbox courses and related data...');

  // The categories to remove
  const categorySlugs = ['iit-jee', 'neet', 'engg-math', 'olympiad-foundation'];

  // Delete everything related to the sandboxed courses
  const categories = await prisma.courseCategory.findMany({
    where: { slug: { in: categorySlugs } }
  });

  const categoryIds = categories.map(c => c.id);

  if (categoryIds.length === 0) {
    console.log('No sandboxed categories found. Exit.');
    return;
  }

  const courses = await prisma.course.findMany({
    where: { categoryId: { in: categoryIds } }
  });

  const courseIds = courses.map(c => c.id);

  if (courseIds.length > 0) {
    // Delete purchases
    await prisma.purchase.deleteMany({
      where: { courseId: { in: courseIds } }
    });

    // Delete tests and questions
    const tests = await prisma.test.findMany({
      where: { courseId: { in: courseIds } }
    });
    const testIds = tests.map(t => t.id);

    if (testIds.length > 0) {
      const questions = await prisma.question.findMany({
        where: { testId: { in: testIds } }
      });
      const questionIds = questions.map(q => q.id);
      
      await prisma.questionOption.deleteMany({
        where: { questionId: { in: questionIds } }
      });
      await prisma.question.deleteMany({
        where: { testId: { in: testIds } }
      });
      await prisma.test.deleteMany({
        where: { courseId: { in: courseIds } }
      });
    }

    // Delete Study Materials
    await prisma.studyMaterial.deleteMany({
      where: { courseId: { in: courseIds } }
    });

    // Delete Lectures and progress
    const lectures = await prisma.lecture.findMany({
      where: { courseId: { in: courseIds } }
    });
    const lectureIds = lectures.map(l => l.id);

    if (lectureIds.length > 0) {
      await prisma.lectureProgress.deleteMany({
        where: { lectureId: { in: lectureIds } }
      });
      await prisma.lecture.deleteMany({
        where: { courseId: { in: courseIds } }
      });
    }

    // Delete CourseTeachers
    await prisma.courseTeacher.deleteMany({
      where: { courseId: { in: courseIds } }
    });

    // Delete Courses
    await prisma.course.deleteMany({
      where: { id: { in: courseIds } }
    });
  }

  // Delete Categories
  await prisma.courseCategory.deleteMany({
    where: { id: { in: categoryIds } }
  });

  console.log('Successfully removed sandboxed courses.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
