// Vercel serverless 入口：把 NestJS (Express) 应用作为单个函数暴露。
// 前置条件：`nest build` 已产出 ./dist（vercel-build 脚本会执行）。
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { NestFactory } = require('@nestjs/core');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ValidationPipe } = require('@nestjs/common');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AppModule } = require('../dist/app.module');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TransformInterceptor } = require('../dist/common/interceptors/transform.interceptor');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { json, urlencoded } = require('express');

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

module.exports = async (req, res) => {
  const app = cachedApp || (cachedApp = await bootstrap());
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
};
