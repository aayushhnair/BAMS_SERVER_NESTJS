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
    app.enableCors({
      origin: corsOrigins.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  } else {
    // Development: allow all origins
    app.enableCors();
  }

  await app.listen(port, host);
  console.log(`Application is running on: http://${host}:${port}`);
}
bootstrap();
