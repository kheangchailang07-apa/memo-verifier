import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    res.status(401).json({ success: false, message: 'API key required' });
    return;
  }
  const expected = process.env.API_KEY_SECRET as string;
  if (!expected || apiKey !== expected) {
    res.status(401).json({ success: false, message: 'Invalid API key' });
    return;
  }
  next();
};

export const generateApiKey = (): string => {
  return crypto.randomBytes(32).toString('hex');
};
