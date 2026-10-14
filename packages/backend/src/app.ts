import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { apiRouter } from './routes.js';
import { openApiSpec } from './openapi.js';

export function createApp(): express.Application {
  const app = express();

  // Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Swagger UI requires inline scripts/styles
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS Policy (Permits local web and mobile dev ports)
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:19006',
    'http://localhost:8081',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('CORS blocked by GCC security policy'));
        }
      },
      credentials: true,
    })
  );

  // Parsers with size boundaries (Prevent Denial of Service / Memory exhaustion)
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use(cookieParser());

  // OpenAPI Documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/api/docs.json', (_req, res) => {
    res.json(openApiSpec);
  });

  // Mount Authoritative API Router
  app.use('/api', apiRouter);

  // 404 Handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint does not exist' });
  });

  // Centralized Error Handler (Never leak stack traces in production)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const isProduction = process.env.NODE_ENV === 'production';
    console.error('[API_ERROR]', err);

    res.status(err.status || 500).json({
      error: err.code || 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'An unexpected server error occurred.' : err.message || 'Internal error',
      ...(isProduction ? {} : { stack: err.stack }),
    });
  });

  return app;
}
