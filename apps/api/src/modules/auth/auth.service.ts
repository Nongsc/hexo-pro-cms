import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async checkFirstUse() {
    const users = await this.prisma.user.findMany({
      select: { isTemporary: true },
    });
    const hasRealUser = users.some((u) => !u.isTemporary);
    const hasTemporaryUser = users.some((u) => u.isTemporary);
    return { isFirstUse: !hasRealUser, hasTemporaryUser };
  }

  private signToken(user: {
    id: string;
    username: string;
    role: string;
    isTemporary: boolean;
  }): string {
    const payload: JwtUser = {
      sub: user.id,
      username: user.username,
      role: user.role,
      isTemporary: user.isTemporary,
    };
    return this.jwt.sign(payload);
  }

  async register(dto: {
    username: string;
    password: string;
    confirmPassword: string;
    avatar?: string;
    securityQuestion?: string;
    securityAnswer?: string;
  }) {
    if (!dto.username || !dto.password) {
      throw new BadRequestException('用户名和密码不能为空');
    }
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('两次输入的密码不一致');
    }
    const realCount = await this.prisma.user.count({
      where: { isTemporary: false },
    });
    if (realCount > 0) {
      throw new BadRequestException('系统已初始化，不能重复注册');
    }
    const exists = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (exists) throw new BadRequestException('用户名已存在');

    await this.prisma.user.deleteMany({ where: { isTemporary: true } });

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash: await bcrypt.hash(dto.password, 10),
        avatar: dto.avatar || '',
        isTemporary: false,
        securityQuestion: dto.securityQuestion || '',
        securityAnswer: dto.securityAnswer
          ? await bcrypt.hash(dto.securityAnswer, 10)
          : '',
        settings: { create: {} },
      },
    });

    return {
      token: this.signToken(user),
      username: user.username,
      avatar: user.avatar,
    };
  }

  async skipSetup() {
    const users = await this.prisma.user.findMany({
      select: { isTemporary: true },
    });
    if (users.some((u) => !u.isTemporary)) {
      throw new BadRequestException('系统已初始化，不能跳过设置');
    }
    let temp = await this.prisma.user.findFirst({
      where: { isTemporary: true },
    });
    if (!temp) {
      temp = await this.prisma.user.create({
        data: {
          username: `temp_${Date.now()}`,
          isTemporary: true,
          settings: { create: {} },
        },
      });
    }
    return {
      token: this.signToken(temp),
      username: temp.username,
      isTemporary: true,
    };
  }

  async login(dto: { username: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('用户名或密码错误');
    return {
      token: this.signToken(user),
      username: user.username,
      avatar: user.avatar,
    };
  }

  async getSecurityQuestion(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.isTemporary) throw new BadRequestException('用户不存在');
    return { question: user.securityQuestion };
  }

  async resetPassword(dto: {
    username: string;
    securityAnswer: string;
    newPassword: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (!user || !user.securityAnswer) {
      throw new BadRequestException('该用户未设置安全问题，无法重置密码');
    }
    const ok = await bcrypt.compare(dto.securityAnswer, user.securityAnswer);
    if (!ok) throw new BadRequestException('安全问题答案错误');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) },
    });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      role: user.role,
      isTemporary: user.isTemporary,
      securityQuestion: user.securityQuestion,
      menuCollapsed: user.settings?.menuCollapsed ?? false,
      editorMode: user.settings?.editorMode ?? 'ir',
      locale: user.settings?.locale ?? 'zh',
    };
  }

  async refresh(user: JwtUser) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
    });
    if (!dbUser) throw new UnauthorizedException('用户不存在');
    return { token: this.signToken(dbUser) };
  }

  async refreshToken(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<JwtUser>(token);
      const dbUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!dbUser) throw new UnauthorizedException('用户不存在');
      return {
        token: this.signToken(dbUser),
        username: dbUser.username,
        avatar: dbUser.avatar,
      };
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
  }
}
