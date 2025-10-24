import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  const port = configService.get('port') || 4000;
  const host = configService.get('host') || '0.0.0.0';

  // Enable CORS for cross-origin requests
  // In production, specify exact origins in environment variables
  const corsOrigins = configService.get('corsOrigins');
  
  if (corsOrigins) {
    const allowedOrigins = corsOrigins.split(',').map(origin => origin.trim());
    console.log('🌐 CORS enabled for origins:', allowedOrigins);
    
    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
      exposedHeaders: ['Content-Disposition'],
      maxAge: 3600, // Cache preflight requests for 1 hour
    });
  } else {
    // Development: allow all origins
    console.log('🌐 CORS enabled for all origins (development mode)');
    app.enableCors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
      exposedHeaders: ['Content-Disposition'],
    });
  }

  // Disable Express ETag for API responses to avoid conditional GET / 304 responses
  // which can cause the client to display stale cached payloads for dynamic API routes.
  try {
    const expressApp = app.getHttpAdapter().getInstance();
    if (expressApp && typeof expressApp.set === 'function') {
      expressApp.set('etag', false);
      console.log('⚙️  Express ETag disabled for API responses');
    }
  } catch (err) {
    // Non-fatal: if we can't access the underlying adapter, continue without crashing
    console.warn('Unable to disable ETag on underlying HTTP adapter:', err?.message || err);
  }

  // Add a lightweight middleware to prevent caching for API and internal routes.
  // This ensures clients and intermediate caches do not return stale session lists.
  app.use((req, res, next) => {
    try {
      if (typeof req.path === 'string' && (req.path.startsWith('/api') || req.path.startsWith('/internal'))) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    } catch (e) {
      // ignore header errors
    }
    return next();
  });

  await app.listen(port, host);
  console.log(`Application is running on: http://${host}:${port}`);
}
bootstrap();
