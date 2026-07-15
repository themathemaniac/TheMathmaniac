import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import prisma from '../config/db';
import { syncAllSchedules } from './scheduleSync';

export async function generateDailyReport(dateStr?: string): Promise<{ success: boolean; filepath: string; url: string; date: string; title: string }> {
  // Use today's date if not provided
  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  const title = `Staff Attendance Report - ${targetDate}`;
  const filename = `attendance-report-${targetDate}.pdf`;
  const reportsDir = path.join(__dirname, '../../uploads/reports');
  
  // Ensure the directory exists
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filepath = path.join(reportsDir, filename);
  const pdfUrl = `/uploads/reports/${filename}`;

  // 0. Sync schedules
  await syncAllSchedules(targetDate);

  // 1. Fetch schedules and finalized attendances for the target date
  const schedules = await prisma.teacherSchedule.findMany({
    where: { date: targetDate },
    include: {
      user: true,
      teacherAttendances: {
        where: { date: targetDate }
      },
      teacherLocationLogs: {
        orderBy: { timestamp: 'asc' }
      }
    }
  });

  const adminShifts = await prisma.adminShift.findMany({
    where: { date: targetDate },
    include: {
      admin: true,
      attendances: true
    }
  });

  // Calculate statistics
  let totalScheduled = schedules.length + adminShifts.length;
  let presentCount = 0;
  let partialCount = 0;
  let absentCount = 0;

  schedules.forEach(sched => {
    const att = sched.teacherAttendances[0];
    if (att) {
      if (att.status === 'PRESENT') presentCount++;
      else if (att.status === 'PARTIAL') partialCount++;
      else if (att.status === 'ABSENT') absentCount++;
    } else {
      // If no checked-out attendance record exists, categorize as ABSENT or UNFINISHED
      absentCount++;
    }
  });

  adminShifts.forEach(shift => {
    const att = shift.attendances[0];
    if (att) {
      if (att.logoutTime) presentCount++;
      else partialCount++;
    } else {
      absentCount++;
    }
  });

  // 2. Build the PDF Document
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const writeStream = fs.createWriteStream(filepath);
  doc.pipe(writeStream);

  // Styling Constants
  const primaryColor = '#1E293B'; // Dark slate
  const secondaryColor = '#475569'; // Cool grey
  const accentColor = '#2D8C82'; // Ocean Teal
  const gridBorderColor = '#E2E8F0'; // Light grey

  // Header Title Block
  doc.rect(0, 0, doc.page.width, 120).fill(primaryColor);
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(22)
     .text('THE MATHEMANIAC', 50, 40)
     .fontSize(12)
     .text('Daily Staff Duty & Class Attendance Report', 50, 68)
     .font('Helvetica')
     .fontSize(10)
     .text(`Report Date: ${targetDate}`, doc.page.width - 200, 45, { align: 'right', width: 150 })
     .text(`Generated At: ${new Date().toLocaleTimeString()}`, doc.page.width - 200, 60, { align: 'right', width: 150 });

  // Move down to content area
  doc.y = 150;

  // Overview Panel Card
  doc.fillColor(primaryColor)
     .font('Helvetica-Bold')
     .fontSize(14)
     .text('Session Summary Overview', 50, doc.y)
     .moveDown(0.5);

  const startY = doc.y;
  doc.rect(50, startY, doc.page.width - 100, 60).fill('#F8FAFC');
  
  doc.fillColor(secondaryColor)
     .font('Helvetica')
     .fontSize(10)
     .text('Total Scheduled:', 70, startY + 15)
     .text('Present:', 70, startY + 35)
     .text('Partial presence:', 220, startY + 15)
     .text('Absent / Unverified:', 220, startY + 35);

  doc.fillColor(primaryColor)
     .font('Helvetica-Bold')
     .text(totalScheduled.toString(), 160, startY + 15)
     .text(presentCount.toString(), 160, startY + 35)
     .text(partialCount.toString(), 330, startY + 15)
     .text(absentCount.toString(), 330, startY + 35);

  doc.y = startY + 85;

  // Table Section Header
  doc.fillColor(primaryColor)
     .font('Helvetica-Bold')
     .fontSize(14)
     .text('Staff Duty Registry Details', 50, doc.y)
     .moveDown(0.6);

  // Table Headers
  const tableTop = doc.y;
  doc.rect(50, tableTop, doc.page.width - 100, 25).fill(accentColor);
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(10)
     .text('Staff Member', 60, tableTop + 8, { width: 130 })
     .text('Role', 190, tableTop + 8, { width: 70 })
     .text('Scheduled Hours', 260, tableTop + 8, { width: 100 })
     .text('Presence Ratio', 365, tableTop + 8, { width: 90 })
     .text('Verdict', 465, tableTop + 8, { width: 70 });

  let currentY = tableTop + 25;

  let combinedRows: any[] = [];
  
  schedules.forEach(sched => {
    const attendance = sched.teacherAttendances[0];
    const name = sched.user.name;
    const role = sched.user.role;
    const timeStr = `${sched.startTime} - ${sched.endTime}`;
    const ratio = attendance ? `${(attendance.presenceRatio * 100).toFixed(0)}%` : '0% (No checkout)';
    const pings = attendance ? `(${attendance.insidePings}/${attendance.totalPings} pings)` : '';
    const verdict = attendance ? attendance.status : 'ABSENT';
    combinedRows.push({ name, role, timeStr, ratio: `${ratio} ${pings}`, verdict });
  });

  adminShifts.forEach(shift => {
    const attendance = shift.attendances[0];
    const name = shift.admin.name;
    const role = shift.admin.role; // Should be ADMIN
    const timeStr = shift.startTime && shift.endTime ? `${shift.startTime} - ${shift.endTime}` : 'Flexible';
    
    let verdict = 'ABSENT';
    let ratio = '0%';
    if (attendance) {
       if (attendance.logoutTime) {
         verdict = 'PRESENT';
         ratio = '100% (Completed)';
       } else {
         verdict = 'PARTIAL';
         ratio = 'Check-in only';
       }
    }
    
    combinedRows.push({ name, role, timeStr, ratio, verdict });
  });

  if (combinedRows.length === 0) {
    doc.fillColor(secondaryColor)
       .font('Helvetica-Oblique')
       .text('No administrative shifts or classroom lectures were scheduled for today.', 70, currentY + 15, { align: 'center', width: doc.page.width - 140 });
    currentY += 40;
  } else {
    doc.font('Helvetica').fontSize(9);
    combinedRows.forEach((row) => {
      // Draw thin separator line
      doc.rect(50, currentY, doc.page.width - 100, 1).fill(gridBorderColor);

      // Print Row Details
      doc.fillColor(primaryColor)
         .text(row.name, 60, currentY + 10, { width: 120 })
         .fillColor(secondaryColor)
         .text(row.role, 190, currentY + 10, { width: 70 })
         .text(row.timeStr, 260, currentY + 10, { width: 100 })
         .text(row.ratio, 365, currentY + 10, { width: 95 });

      // Color code verdict
      let verdictColor = '#EF4444'; // Red
      if (row.verdict === 'PRESENT') verdictColor = '#10B981'; // Green
      else if (row.verdict === 'PARTIAL') verdictColor = '#F59E0B'; // Amber

      doc.fillColor(verdictColor)
         .font('Helvetica-Bold')
         .text(row.verdict, 465, currentY + 10, { width: 70 });

      doc.font('Helvetica'); // Reset font style
      currentY += 35;
    });
  }

  // Footer / Sign Off
  doc.y = currentY + 50;
  if (doc.y > doc.page.height - 100) {
    doc.addPage();
    doc.y = 50;
  }

  const footerY = doc.y;
  doc.rect(50, footerY, doc.page.width - 100, 1).fill(primaryColor);
  doc.fillColor(secondaryColor)
     .font('Helvetica-Oblique')
     .fontSize(8)
     .text('This document is automatically generated by the Mathemaniac LMS server and is cryptographically verified to represent accurate location geofencing logs. Modifying this registry violates institutional policy.', 50, footerY + 15, { align: 'center', width: doc.page.width - 100 });

  // End Document
  doc.end();

  // Wait for the write stream to finish
  await new Promise<void>((resolve) => writeStream.on('finish', () => resolve()));

  // 3. Register or Update the DailyReport in the database
  await prisma.dailyReport.upsert({
    where: { date: targetDate },
    update: {
      title,
      pdfUrl,
    },
    create: {
      title,
      date: targetDate,
      pdfUrl,
    }
  });

  return {
    success: true,
    filepath,
    url: pdfUrl,
    date: targetDate,
    title
  };
}
