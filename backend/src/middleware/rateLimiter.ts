import { Request, Response, NextFunction } from 'express';

interface LoginAttemptRecord {
  count: number;
  lockUntil: number;
}

// In-memory brute-force protection map
const loginAttempts = new Map<string, LoginAttemptRecord>();

export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const phone = req.body.phoneNumber || '';
  const key = `${ip}:${phone}`;

  const record = loginAttempts.get(key);

  if (record && record.lockUntil > Date.now()) {
    const waitSeconds = Math.ceil((record.lockUntil - Date.now()) / 1000);
    return res.status(429).json({
      success: false,
      error: `Too many failed login attempts. Please try again after ${waitSeconds} seconds.`
    });
  }

  next();
}

export function recordLoginFailure(req: Request) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const phone = req.body.phoneNumber || '';
  const key = `${ip}:${phone}`;

  const record = loginAttempts.get(key) || { count: 0, lockUntil: 0 };
  record.count += 1;

  if (record.count >= 5) {
    record.lockUntil = Date.now() + 60 * 1000; // 1-minute lockout
    record.count = 0; // reset failures counter after triggering lock
  }

  loginAttempts.set(key, record);
}

export function clearLoginAttempts(req: Request) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const phone = req.body.phoneNumber || '';
  const key = `${ip}:${phone}`;
  loginAttempts.delete(key);
}
