import cron from 'node-cron';
import { generateDailyReport } from './reportBuilder';
import prisma from '../config/db';
import { createNotificationAndPush } from '../utils/notifications';

export function startScheduler() {
  console.log('[Scheduler Service] Initializing daily and monthly cron schedulers...');
  
  // Schedule daily report generation at 11:55 PM (23:55)
  cron.schedule('55 23 * * *', async () => {
    console.log('[Scheduler] Executing daily staff attendance PDF generation task...');
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const result = await generateDailyReport(todayStr);
      console.log(`[Scheduler] Daily report generated successfully: ${result.title} | URL: ${result.url}`);
    } catch (err: any) {
      console.error('[Scheduler Error] Daily report generation failed:', err.message || err);
    }
  });

  // Schedule monthly late fee warning notification on the 8th of every month at 10:00 AM (0 10 8 * *)
  cron.schedule('0 10 8 * *', async () => {
    console.log('[Scheduler] Executing monthly late fee warning notification task...');
    try {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const currentMonth = `${now.getFullYear()}-${mm}`;

      // Get all students
      const students = await prisma.user.findMany({
        where: { role: 'STUDENT' }
      });

      for (const student of students) {
        // Find successful purchases/enrollments
        const purchases = await prisma.purchase.findMany({
          where: { userId: student.id, status: 'SUCCESS' },
          include: { course: true }
        });

        for (const purchase of purchases) {
          // Check if there is a SUCCESS fee payment
          const successPayment = await prisma.feePayment.findFirst({
            where: {
              userId: student.id,
              courseId: purchase.courseId,
              month: currentMonth,
              status: 'SUCCESS'
            }
          });

          if (!successPayment) {
            // Send warning notification
            await createNotificationAndPush(
              student.id,
              'Fee Payment Due Warning ⚠️',
              `Please pay your monthly tuition fee for "${purchase.course.title}" within the 10th of this month to avoid a late fine of ₹50 per week.`
            );
            console.log(`[Scheduler] Sent due warning to user ${student.name} for course ${purchase.course.title}`);
          }
        }
      }
    } catch (err: any) {
      console.error('[Scheduler Error] Monthly warning task failed:', err.message || err);
    }
  });

  // Schedule attendance check-in and check-out reminders every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduler] Executing teacher attendance checks...');
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const schedules = await prisma.teacherSchedule.findMany({
        where: { date: todayStr }
      });

      for (const schedule of schedules) {
        const startMin = parseTimeStringToMinutes(schedule.startTime);
        const endMin = parseTimeStringToMinutes(schedule.endTime);

        const diffStart = currentMinutes - startMin;
        const diffEnd = currentMinutes - endMin;

        // 1. Check-in check (starts 10-25 minutes ago)
        if (diffStart >= 10 && diffStart <= 25) {
          const attendance = await prisma.teacherAttendance.findFirst({
            where: { scheduleId: schedule.id }
          });
          
          // If no check-in recorded yet
          if (!attendance || !attendance.loginTime) {
            const alreadyNotified = await prisma.notification.findFirst({
              where: {
                userId: schedule.userId,
                title: 'Check-in Reminder 📍',
                createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) },
                body: { contains: schedule.title }
              }
            });

            if (!alreadyNotified) {
              await createNotificationAndPush(
                schedule.userId,
                'Check-in Reminder 📍',
                `Your class "${schedule.title}" started ${diffStart} minutes ago. Please make sure to check in (start location tracking) and log student attendance.`
              );
              console.log(`[Scheduler] Sent check-in reminder to teacher ${schedule.userId} for schedule ${schedule.id}`);
            }
          }
        }

        // 2. Checkout check (ended 5-20 minutes ago)
        if (diffEnd >= 5 && diffEnd <= 20) {
          const attendance = await prisma.teacherAttendance.findFirst({
            where: { scheduleId: schedule.id }
          });

          // If checked in but not checked out yet
          if (attendance && attendance.loginTime && !attendance.logoutTime) {
            const alreadyNotifiedCheckout = await prisma.notification.findFirst({
              where: {
                userId: schedule.userId,
                title: 'Checkout Reminder 📍',
                createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) },
                body: { contains: schedule.title }
              }
            });

            if (!alreadyNotifiedCheckout) {
              await createNotificationAndPush(
                schedule.userId,
                'Checkout Reminder 📍',
                `Your class "${schedule.title}" ended ${diffEnd} minutes ago. Please end your session tracking to log out your attendance.`
              );
              console.log(`[Scheduler] Sent checkout reminder to teacher ${schedule.userId} for schedule ${schedule.id}`);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[Scheduler Error] Teacher attendance checks task failed:', err.message || err);
    }
  });

  console.log('[Scheduler Service] Schedulers are active.');
}

function parseTimeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().toUpperCase();
  const isPm = clean.includes('PM');
  const isAm = clean.includes('AM');
  
  const timePart = clean.replace(/(AM|PM)/, '').trim();
  const [hoursStr, minutesStr] = timePart.split(':');
  let hours = parseInt(hoursStr, 10) || 0;
  const minutes = parseInt(minutesStr, 10) || 0;
  
  if (isPm && hours < 12) {
    hours += 12;
  }
  if (isAm && hours === 12) {
    hours = 0;
  }
  
  return hours * 60 + minutes;
}
