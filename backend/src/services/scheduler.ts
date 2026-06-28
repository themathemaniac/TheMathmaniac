import cron from 'node-cron';
import { generateDailyReport } from './reportBuilder';
import prisma from '../config/db';

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
            await prisma.notification.create({
              data: {
                userId: student.id,
                title: 'Fee Payment Due Warning ⚠️',
                body: `Please pay your monthly tuition fee for "${purchase.course.title}" within the 10th of this month to avoid a late fine of ₹50 per week.`
              }
            });
            console.log(`[Scheduler] Sent due warning to user ${student.name} for course ${purchase.course.title}`);
          }
        }
      }
    } catch (err: any) {
      console.error('[Scheduler Error] Monthly warning task failed:', err.message || err);
    }
  });

  console.log('[Scheduler Service] Schedulers are active.');
}
