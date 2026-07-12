const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const schedules = await prisma.teacherSchedule.findMany();
  console.log('Schedules:', schedules.length, schedules);
  const courseTeachers = await prisma.courseTeacher.findMany();
  console.log('Course Teachers:', courseTeachers.length, courseTeachers);
}

main().finally(() => prisma.$disconnect());
