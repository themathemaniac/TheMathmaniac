import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import lectureRoutes from './routes/lectures';
import materialRoutes from './routes/materials';
import testRoutes from './routes/tests';
import paymentRoutes from './routes/payments';
import profileRoutes from './routes/profile';


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware configurations
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes Bindings
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/lectures', lectureRoutes);
app.use('/api/v1/materials', materialRoutes);
app.use('/api/v1/tests', testRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/profile', profileRoutes);

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
