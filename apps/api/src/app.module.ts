import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import configuration from './config/configuration';
import { CosModule } from './cos/cos.module';
import { GithubModule } from './github/github.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigsModule } from './modules/configs/configs.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DeployModule } from './modules/deploy/deploy.module';
import { ImagesModule } from './modules/images/images.module';
import { PagesModule } from './modules/pages/pages.module';
import { PostsModule } from './modules/posts/posts.module';
import { RecycleModule } from './modules/recycle/recycle.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ThemeModule } from './modules/theme/theme.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

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
