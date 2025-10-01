import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // DEBUG: Log database configuration (only show if vars exist)
  console.log('🔍 Database Configuration Check:');
  console.log('  DB_HOST:', process.env.DB_HOST ? '✓ SET' : '✗ MISSING');
  console.log('  DB_PORT:', process.env.DB_PORT ? '✓ SET' : '✗ MISSING');
  console.log('  DB_NAME:', process.env.DB_NAME ? '✓ SET' : '✗ MISSING');
  console.log('  DB_USERNAME:', process.env.DB_USERNAME ? '✓ SET' : '✗ MISSING');
  console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '✓ SET' : '✗ MISSING');
  console.log('  DB_SSL:', process.env.DB_SSL);
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  
  const app = await NestFactory.create(AppModule);

  // Enable CORS for all origins
  app.enableCors({
    origin: true, // Allows all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Allows cookies and auth headers
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
