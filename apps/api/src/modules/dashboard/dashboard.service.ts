import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { AddTodoDto } from './dto/dashboard.dto.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async postsStats() {
    const [published, draft, discarded, pages] = await Promise.all([
      this.prisma.post.count({ where: { status: 'published' } }),
      this.prisma.post.count({ where: { status: 'draft' } }),
      this.prisma.post.count({ where: { status: 'discarded' } }),
      this.prisma.page.count({ where: { status: { not: 'discarded' } } }),
    ]);
    return { published, draft, discarded, pages };
  }

  private async taxonomy(field: 'categories' | 'tags') {
    const posts = await this.prisma.post.findMany({
      where: { status: { not: 'discarded' } },
      select: { [field]: true },
    });
    const map = new Map<string, number>();
    for (const p of posts) {
      for (const t of p[field] as string[]) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  categoriesList() {
    return this.taxonomy('categories');
  }

  tagsList() {
    return this.taxonomy('tags');
  }

  async recentPosts(limit = 5) {
    const rows = await this.prisma.post.findMany({
      where: { status: { not: 'discarded' } },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: Math.min(limit, 20),
    });
    return rows.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      permalink: p.permalink,
      updatedAt: p.updatedAt,
    }));
  }

  async systemInfo() {
    const github = await this.settings.getGithubConfig();
    const cos = await this.settings.getCosConfig();
    const site = await this.settings.getSystemConfig();
    const [posts, pages] = await Promise.all([
      this.prisma.post.count({ where: { status: { not: 'discarded' } } }),
      this.prisma.page.count({ where: { status: { not: 'discarded' } } }),
    ]);
    return {
      site,
      github: this.settings.maskGithub(github),
      cos: this.settings.maskCos(cos),
      stats: { posts, pages },
    };
  }

  async monthlyStats() {
    const posts = await this.prisma.post.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const map = new Map<string, number>();
    for (const p of posts) {
      const key = p.createdAt.toISOString().slice(0, 7);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async visitStats() {
    // No analytics backend wired; return a neutral shape for the dashboard.
    return { today: 0, total: 0, series: [] };
  }

  todosList() {
    return this.prisma.todo.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async todoAdd(dto: AddTodoDto) {
    return this.prisma.todo.create({
      data: { content: dto.content, done: dto.done ?? false },
    });
  }

  async todoToggle(id: string) {
    const todo = await this.prisma.todo.findUnique({ where: { id } });
    if (!todo) return null;
    return this.prisma.todo.update({
      where: { id },
      data: { done: !todo.done },
    });
  }

  async todoDelete(id: string) {
    await this.prisma.todo.deleteMany({ where: { id } });
    return { ok: true };
  }
}
