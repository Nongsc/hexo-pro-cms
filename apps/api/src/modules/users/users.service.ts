import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CosService } from '../../cos/cos.service';
import { UpdateProfileDto } from './dto/users.dto';

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
  };
  return map[mime] || 'png';
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cos: CosService,
  ) {}

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');

    const data: any = {};
    if (dto.avatar !== undefined) data.avatar = dto.avatar;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.securityQuestion !== undefined)
      data.securityQuestion = dto.securityQuestion || '';
    if (dto.securityAnswer)
      data.securityAnswer = await bcrypt.hash(dto.securityAnswer, 10);

    if (dto.username && dto.username !== user.username) {
      const exists = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (exists) throw new BadRequestException('用户名已存在');
      data.username = dto.username;
    }

    const settingsUpdate: any = {};
    if (dto.menuCollapsed !== undefined)
      settingsUpdate.menuCollapsed = dto.menuCollapsed;
    if (dto.editorMode !== undefined) settingsUpdate.editorMode = dto.editorMode;
    if (dto.locale !== undefined) settingsUpdate.locale = dto.locale;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        settings: {
          upsert: {
            create: {
              menuCollapsed: dto.menuCollapsed ?? false,
              editorMode: dto.editorMode ?? 'ir',
              locale: dto.locale ?? 'zh',
            },
            update: settingsUpdate,
          },
        },
      },
      include: { settings: true },
    });

    return {
      username: updated.username,
      avatar: updated.avatar,
      menuCollapsed: updated.settings?.menuCollapsed,
      editorMode: updated.settings?.editorMode,
      locale: updated.settings?.locale,
    };
  }

  async uploadAvatar(userId: string, data: string) {
    const m = /^data:([A-Za-z-+\/]+);base64,(.+)$/.exec(data || '');
    if (!m) throw new BadRequestException('无效的图片数据');
    const mime = m[1];
    const buffer = Buffer.from(m[2], 'base64');
    const key = `avatar/${userId}_${Date.now()}.${mimeToExt(mime)}`;
    const { url } = await this.cos.putObject(key, buffer, mime);
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: url },
    });
    return { url };
  }
}
