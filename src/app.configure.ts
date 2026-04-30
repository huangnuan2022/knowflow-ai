import { INestApplication, ValidationPipe } from '@nestjs/common';

const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function configureApp(app: INestApplication) {
  app.enableCors({
    origin: parseCorsOrigin(process.env.CORS_ORIGIN),
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
}

export function parseCorsOrigin(value?: string) {
  return value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? DEFAULT_CORS_ORIGINS;
}
