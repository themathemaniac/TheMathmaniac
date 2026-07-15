import prisma from '../config/db';

export async function syncAllSchedules(targetDateStr: string, targetUserId?: string) {
  try {
    const [year, month, day] = targetDateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = shortDays[d.getDay()];
    const dayOfWeekNum = d.getDay();

    // 1. Sync Teacher Schedules
    const courseTeachers = await prisma.courseTeacher.findMany({
      where: targetUserId ? { userId: targetUserId } : undefined,
      include: { course: { include: { category: true } }, user: true }
    });

    for (const ct of courseTeachers) {
      const course = ct.course;
      if (!course.timeSlots) continue;
      
      let slots: any[] = [];
      try {
        slots = typeof course.timeSlots === 'string' ? JSON.parse(course.timeSlots) : course.timeSlots;
      } catch(e) {}
      
      for (const slot of slots) {
        if (!slot.day || !slot.startTime || !slot.endTime) continue;
        const slotDayStr = slot.day.substring(0, 3);
        
        if (dayName === slotDayStr) {
          const title = course.title;
          const campus = course.branch || 'Madhyamgram';
          const targetClass = course.targetClass || '';
          const subject = course.category?.name || '';
          
          const existing = await prisma.teacherSchedule.findFirst({
             where: { userId: ct.userId, date: targetDateStr, startTime: slot.startTime, endTime: slot.endTime, title }
          });
          
          if (!existing) {
             await prisma.teacherSchedule.create({
                data: {
                   userId: ct.userId,
                   title,
                   campus,
                   class: targetClass,
                   subject,
                   date: targetDateStr,
                   startTime: slot.startTime,
                   endTime: slot.endTime
                }
             });
             console.log(`[Schedule Sync] Created TeacherSchedule for ${ct.userId} on ${targetDateStr}: ${title}`);
          }
        }
      }
    }

    // 2. Sync Admin Shifts (Virtual to Real DB Record)
    const adminPatterns = await prisma.adminWeeklyPattern.findMany({
      where: {
        ...(targetUserId ? { adminId: targetUserId } : {}),
        dayOfWeek: dayOfWeekNum
      }
    });

    for (const pattern of adminPatterns) {
      let existingShift = await prisma.adminShift.findFirst({
        where: { adminId: pattern.adminId, date: targetDateStr },
      });

      if (!existingShift) {
        // Check for an approved branch swap request
        const approvedSwap = await prisma.adminBranchSwapRequest.findFirst({
          where: { adminId: pattern.adminId, date: targetDateStr, status: 'APPROVED' }
        });
        const activeBranch = approvedSwap ? approvedSwap.requestedBranch : pattern.branch;

        await prisma.adminShift.create({
          data: {
            adminId: pattern.adminId,
            branch: activeBranch,
            date: targetDateStr,
            startTime: pattern.startTime,
            endTime: pattern.endTime,
            type: pattern.type,
          },
        });
        console.log(`[Schedule Sync] Created AdminShift for ${pattern.adminId} on ${targetDateStr} at ${activeBranch}`);
      }
    }

  } catch (err: any) {
    console.error('[Schedule Sync Error]', err.message || err);
  }
}
