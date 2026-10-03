// Vercel serverless 入口：把 NestJS (Express) 应用作为单个函数暴露（ESM）。
// 前置条件：`nest build` 已产出 ./dist（vercel-build 脚本会执行）。
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../dist/app.module.js';
import { HttpExceptionFilter } from '../dist/common/filters/http-exception.filter.js';
import { TransformInterceptor } from '../dist/common/interceptors/transform.interceptor.js';
import { json, urlencoded } from 'express';

let cachedApp = null;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    bodyParser: false
  });
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true }
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.init();
  return app;
}

export default async (req, res) => {
  const app = cachedApp || (cachedApp = await bootstrap());
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
};
