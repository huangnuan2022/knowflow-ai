import { INestApplication, ValidationPipe } from '@nestjs/common';

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

function parseCorsOrigin(value?: string) {
  return value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? ['http://localhost:5173'];
}
