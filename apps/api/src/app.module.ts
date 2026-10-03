import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import configuration from './config/configuration.js';
import { CosModule } from './cos/cos.module.js';
import { GithubModule } from './github/github.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ConfigsModule } from './modules/configs/configs.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { DeployModule } from './modules/deploy/deploy.module.js';
import { ImagesModule } from './modules/images/images.module.js';
import { PagesModule } from './modules/pages/pages.module.js';
import { PostsModule } from './modules/posts/posts.module.js';
import { RecycleModule } from './modules/recycle/recycle.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { ThemeModule } from './modules/theme/theme.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    GithubModule,
    CosModule,
    SettingsModule,
    ThemeModule,
    AuthModule,
    UsersModule,
    PostsModule,
    PagesModule,
    ImagesModule,
    ConfigsModule,
    DeployModule,
    DashboardModule,
    RecycleModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
