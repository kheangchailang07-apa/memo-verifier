import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { loadEnv } from './config/env';
import routes from './routes';
import signatureRoutes from './routes/signaturesRoutes';
import { s3SignatureConfig } from './services/s3';
import { initializeDatabase } from './database';
import { apiKeyAuth } from './middlewares/security';

loadEnv();

const app = express();
const PORT = Number(process.env.PORT) || 5422;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// A reverse proxy sits in front of Express in production, so trust it for
// req.ip / protocol — otherwise every audit log records the proxy's address.
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');

// Comma-separated list, e.g. "https://memo.apa1-eva.com,http://localhost:3366".
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3366')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header (curl, same-origin, server-to-server) is accepted.
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })
);

// HTTP access log. The Telegram-link endpoints poll every ~2s per open tab and
// drown the pm2 log in routine 200s, so they are skipped by default.
//   HTTP_LOG=default  log everything except the polling endpoints (default)
//   HTTP_LOG=none     no request logs at all
//   HTTP_LOG=errors   only 4xx/5xx
//   HTTP_LOG=all      log everything
const httpLog = (process.env.HTTP_LOG || 'default').toLowerCase();
const pollingPath = /^\/api\/link-telegram\/(check|me)$/;
const morganSkip = (req: Request, res: Response): boolean => {
  if (httpLog === 'none') return true;
  if (httpLog === 'errors') return res.statusCode < 400;
  if (httpLog === 'all') return false;
  return pollingPath.test(req.path);
};

// app.use(morgan('dev', { skip: morganSkip }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  // Surface the real cause so an S3 permission or credential problem is visible.
  console.error('[RequestError]', err?.message);
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ success: false, message: 'File size exceeds maximum allowed limit of 25 MB' });
    return;
  }
  next(err);
});

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  // The signature artwork is fetched by the browser whenever a signature is
  // shown, so it must not eat into the budget of the API calls.
  skip: (req: Request) => req.path.startsWith(`/${s3SignatureConfig.prefix}/`),
  message: { success: false, message: 'Too many requests, please try again later.' },
});

app.use(limiter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, status: 'ok' });
});

// Electronic signatures are served by this app under the layout of the bucket
// (e.g. /signatures_memo/USR-000/<uuid>.png), so no AWS link ever ends up in
// the database or in a document.
app.use(`/${s3SignatureConfig.prefix}`, signatureRoutes);

app.use('/api', routes);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
};

startServer();

export default app;
