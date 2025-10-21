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

  await app.listen(port, host);
  console.log(`Application is running on: http://${host}:${port}`);
}
bootstrap();
