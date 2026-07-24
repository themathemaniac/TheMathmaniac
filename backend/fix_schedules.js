const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting schedule fix...');
  const todayMs = Date.now();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const getISTDateStr = (timestamp) => new Date(timestamp + istOffset).toISOString().split('T')[0];
  const todayStr = getISTDateStr(todayMs);

  console.log('Deleting from', todayStr);
  await prisma.teacherSchedule.deleteMany({
    where: {
      date: { gte: todayStr },
      teacherAttendances: { none: {} }
    }
  });

  const next14Days = [];
  for (let i = 0; i < 30; i++) {
    const dMs = todayMs + i * 24 * 60 * 60 * 1000;
    next14Days.push(getISTDateStr(dMs));
  }
  const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const courseTeachers = await prisma.courseTeacher.findMany({
    include: { course: { include: { category: true } }, user: true }
  });

  let created = 0;

  for (const ct of courseTeachers) {
    const course = ct.course;
    if (!course.timeSlots) continue;
    
    let slots = [];
    try {
      slots = JSON.parse(course.timeSlots);
    } catch(e) {}
    
    for (const slot of slots) {
      if (!slot.day || !slot.startTime || !slot.endTime) continue;
      const slotDayStr = slot.day.substring(0, 3); 
      
      for (const dateStr of next14Days) {
        const [y, m, dNum] = dateStr.split('-').map(Number);
        const dObj = new Date(y, m - 1, dNum);
        const dayName = shortDays[dObj.getDay()];
        if (dayName === slotDayStr) {
          const title = course.title;
          const campus = course.branch || 'Madhyamgram';
          const targetClass = course.targetClass || '';
          const subject = course.category?.name || '';
          
          const existing = await prisma.teacherSchedule.findFirst({
             where: { userId: ct.userId, date: dateStr, startTime: slot.startTime, endTime: slot.endTime, title }
          });
          
          if (!existing) {
             await prisma.teacherSchedule.create({
                data: {
                   userId: ct.userId,
                   title,
                   campus,
                   class: targetClass,
                   subject,
                   date: dateStr,
                   startTime: slot.startTime,
                   endTime: slot.endTime
                }
             });
             created++;
          }
        }
      }
    }
  }
  console.log('Done! Created', created, 'schedules.');
}

main().finally(() => prisma.$disconnect());
