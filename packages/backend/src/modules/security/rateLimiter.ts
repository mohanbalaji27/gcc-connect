import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipBuckets = new Map<string, RateLimitRecord>();
const userBuckets = new Map<string, RateLimitRecord>();

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}) {
  const { windowMs, max, message = 'Rate limit exceeded. Please try again later.', keyPrefix = 'rl' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const userId = (req as any).user?.id || 'anon';
    const key = `${keyPrefix}:${ip}:${userId}`;

    const now = Date.now();
    let record = ipBuckets.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      ipBuckets.set(key, record);
      return next();
    }

    record.count++;
    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message,
        retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

// Pre-configured rate limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please wait 5 minutes before trying again.',
});

export const bookingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyPrefix: 'booking',
  message: 'Too many booking requests. Please slow down.',
});

export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 150,
  keyPrefix: 'api',
  message: 'API rate limit exceeded. Please try again shortly.',
});
