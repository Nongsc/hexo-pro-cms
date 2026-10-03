import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CosService } from '../../cos/cos.service.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  ConfirmDto,
  MoveImageDto,
  PresignDto,
  RenameImageDto,
  UploadImageDto,
} from './dto/images.dto.js';

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
  };
  return map[mime] || '';
}

function extFromName(name: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

function sanitizeFilename(name: string): string {
  const safe = String(name || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return safe || `image_${Date.now()}`;
}

@Injectable()
export class ImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cos: CosService,
    private readonly settings: SettingsService,
  ) {}

  async config() {
    const cfg = await this.settings.getCosConfig();
    return this.settings.maskCos(cfg);
  }

  async saveConfig(dto: any) {
    return this.settings.saveCosConfig(dto);
  }

  async folders() {
    const rows = await this.prisma.image.findMany({
      distinct: ['folder'],
      select: { folder: true },
    });
    return rows.map((r) => r.folder).filter(Boolean);
  }

  async list(query: {
    page?: number;
    pageSize?: number;
    folder?: string;
    keyword?: string;
  }) {
    const page = Math.max(parseInt(String(query.page || 1), 10) || 1, 1);
    const pageSize = Math.min(
      parseInt(String(query.pageSize || 12), 10) || 12,
      100,
    );
    const where: any = {};
    if (query.folder) where.folder = query.folder;
    if (query.keyword) {
      where.filename = { contains: query.keyword, mode: 'insensitive' };
    }
    const [total, list] = await Promise.all([
      this.prisma.image.count({ where }),
      this.prisma.image.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, list };
  }

  async upload(dto: UploadImageDto) {
    let buffer: Buffer;
    let mime = 'image/png';
    let ext = '';

    if (dto.url) {
      const res = await fetch(dto.url);
      if (!res.ok) throw new BadRequestException('下载远程图片失败');
      buffer = Buffer.from(await res.arrayBuffer());
      mime = (res.headers.get('content-type') || 'image/png').split(';')[0];
      ext = mimeToExt(mime) || extFromName(dto.url) || 'png';
    } else if (dto.data) {
      const m = /^data:([A-Za-z-+\/]+);base64,(.+)$/.exec(dto.data);
      if (!m) throw new BadRequestException('无效的图片数据');
      mime = m[1];
      buffer = Buffer.from(m[2], 'base64');
      ext = mimeToExt(mime) || 'png';
    } else {
      throw new BadRequestException('缺少图片数据');
    }

    if (!buffer.length) throw new BadRequestException('图片内容为空');

    let name = sanitizeFilename(dto.filename || `${Date.now()}`);
    if (!extFromName(name)) name = `${name}.${ext}`;

    const cfg = await this.settings.getCosConfig();
    const basePath = cfg.basePath ? `${cfg.basePath.replace(/\/+$/, '')}/` : '';
    const prefix = dto.folder ? `${dto.folder.replace(/\/+$/, '')}/` : '';
    const key = `${basePath}${prefix}${Date.now()}-${randomUUID().slice(0, 8)}-${name}`;
    const { url } = await this.cos.putObject(key, buffer, mime);

    return this.prisma.image.create({
      data: {
        key,
        filename: name,
        url,
        size: buffer.length,
        mimeType: mime,
        folder: dto.folder || '',
      },
    });
  }

  async presign(dto: PresignDto) {
    const cfg = await this.settings.getCosConfig();
    const basePath = cfg.basePath ? `${cfg.basePath.replace(/\/+$/, '')}/` : '';
    const folder = dto.folder || '';
    const prefix = folder ? `${folder.replace(/\/+$/, '')}/` : '';
    const filename = sanitizeFilename(dto.filename || `${Date.now()}`);
    const key = `${basePath}${prefix}${Date.now()}-${randomUUID().slice(0, 8)}-${filename}`;
    const uploadUrl = await this.cos.presignPut(key);
    const url = await this.cos.urlFor(key);
    return { key, uploadUrl, url, filename, expires: 900 };
  }

  async confirm(dto: ConfirmDto) {
    const cfg = await this.settings.getCosConfig();
    const basePath = cfg.basePath ? `${cfg.basePath.replace(/\/+$/, '')}/` : '';
    if (basePath && !dto.key.startsWith(basePath)) {
      throw new BadRequestException('非法的对象 key');
    }
    const url = await this.cos.urlFor(dto.key);
    return this.prisma.image.create({
      data: {
        key: dto.key,
        filename: dto.filename,
        url,
        size: dto.size || null,
        mimeType: dto.contentType || null,
        folder: dto.folder || '',
      },
    });
  }

  async remove(id: string) {
    const img = await this.prisma.image.findUnique({ where: { id } });
    if (!img) throw new NotFoundException('图片不存在');
    await this.cos.deleteObject(img.key).catch(() => undefined);
    await this.prisma.image.delete({ where: { id } });
    return { ok: true };
  }

  async removeBatch(ids: string[]) {
    const imgs = await this.prisma.image.findMany({
      where: { id: { in: ids } },
    });
    const keys = imgs.map((i) => i.key);
    if (keys.length) await this.cos.deleteMultiple(keys).catch(() => undefined);
    await this.prisma.image.deleteMany({ where: { id: { in: ids } } });
    return { ok: true, count: imgs.length };
  }

  async rename(id: string, dto: RenameImageDto) {
    const img = await this.prisma.image.findUnique({ where: { id } });
    if (!img) throw new NotFoundException('图片不存在');
    const filename = sanitizeFilename(dto.filename);
    const cfg = await this.settings.getCosConfig();
    const basePath = cfg.basePath ? `${cfg.basePath.replace(/\/+$/, '')}/` : '';
    const folderPrefix = img.folder ? `${img.folder}/` : '';
    const newKey = `${basePath}${folderPrefix}${filename}`;
    if (newKey !== img.key) {
      await this.cos.copyObject(img.key, newKey);
      await this.cos.deleteObject(img.key).catch(() => undefined);
    }
    const url = await this.cos.urlFor(newKey);
    return this.prisma.image.update({
      where: { id },
      data: { key: newKey, filename, url },
    });
  }

  async move(dto: MoveImageDto) {
    const imgs = await this.prisma.image.findMany({
      where: { id: { in: dto.ids } },
    });
    const cfg = await this.settings.getCosConfig();
    const basePath = cfg.basePath ? `${cfg.basePath.replace(/\/+$/, '')}/` : '';
    for (const img of imgs) {
      const folder = dto.folder || '';
      const prefix = folder ? `${folder.replace(/\/+$/, '')}/` : '';
      const newKey = `${basePath}${prefix}${img.filename}`;
      if (newKey !== img.key) {
        await this.cos.copyObject(img.key, newKey);
        await this.cos.deleteObject(img.key).catch(() => undefined);
      }
      const url = await this.cos.urlFor(newKey);
      await this.prisma.image.update({
        where: { id: img.id },
        data: { key: newKey, url, folder },
      });
    }
    return { ok: true, count: imgs.length };
  }

  private async unusedImages() {
    const images = await this.prisma.image.findMany();
    const posts = await this.prisma.post.findMany({ select: { content: true } });
    const pages = await this.prisma.page.findMany({ select: { content: true } });
    const allText = posts
      .map((p) => p.content)
      .concat(pages.map((p) => p.content))
      .join('\n');
    return images.filter(
      (img) => !allText.includes(img.key) && !allText.includes(img.url),
    );
  }

  async unused() {
    const list = await this.unusedImages();
    return { total: list.length, list };
  }

  async cleanupUnused() {
    const list = await this.unusedImages();
    const ids = list.map((i) => i.id);
    if (ids.length) {
      await this.cos
        .deleteMultiple(list.map((i) => i.key))
        .catch(() => undefined);
      await this.prisma.image.deleteMany({ where: { id: { in: ids } } });
    }
    return { ok: true, count: ids.length };
  }
}
