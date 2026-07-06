import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import courseRoutes from './routes/courses';
import lectureRoutes from './routes/lectures';
import materialRoutes from './routes/materials';
import testRoutes from './routes/tests';
import profileRoutes from './routes/profile';
import attendanceRoutes from './routes/attendance';
import superuserRoutes from './routes/superuser';
import paymentRoutes from './routes/payments';
import adminAttendanceRoutes from './routes/adminAttendance';
import { startFirestoreListener } from './services/firestoreListener';
import { startScheduler } from './services/scheduler';

const app = express();
const PORT = process.env.PORT || 3000;

// Start Firestore real-time sync listener
startFirestoreListener();

// Start Daily Cron Scheduler
startScheduler();

// Middleware configurations
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[HTTP Request] ${req.method} ${req.url}`, req.method === 'POST' || req.method === 'PUT' ? req.body : '');
  const oldJson = res.json;
  res.json = function(data) {
    console.log(`[HTTP Response] ${req.method} ${req.url} - Status: ${res.statusCode}`);
    return oldJson.apply(res, arguments as any);
  };
  next();
});
import { generateDailyReport } from './services/reportBuilder';
import fs from 'fs';

// Routes Bindings
app.get('/uploads/reports/:filename', async (req, res, next) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../uploads/reports', filename);
    if (!fs.existsSync(filePath)) {
      const match = filename.match(/^attendance-report-(\d{4}-\d{2}-\d{2})\.pdf$/);
      if (match) {
        const date = match[1];
        console.log(`[Report Rebuilder] Regenerating missing daily report for date: ${date}`);
        await generateDailyReport(date);
      }
    }
  } catch (error) {
    console.error('[Report Rebuilder Error]', error);
  }
  next();
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes Bindings
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/lectures', lectureRoutes);
app.use('/api/v1/materials', materialRoutes);
app.use('/api/v1/tests', testRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/superuser', superuserRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin-attendance', adminAttendanceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Centralized error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error Handler]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`Mathemaniac Node Express API is live on port: ${PORT}`);
  console.log(`===================================================`);
});

export default app;
