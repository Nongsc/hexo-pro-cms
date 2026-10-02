import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import {
  dateParts,
  formatDateTime,
  normalizeList,
  parseMarkdown,
  serializeMarkdown,
  slugify,
} from '../../common/utils/markdown.util';
import { SavePostDto } from './dto/posts.dto';

interface ListQuery {
  status?: string;
  page?: number;
  pageSize?: number;
  keyword?: string;
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
  ) {}

  // ---- helpers -----------------------------------------------------

  private summary(p: any) {
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      categories: p.categories,
      tags: p.tags,
      permalink: p.permalink,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      frontMatter: p.frontMatter,
    };
  }

  /** Front-matter stored in DB: everything except title/tags/categories. */
  private buildStoredFrontMatter(
    extra: Record<string, any> | undefined,
    existingDate?: string,
  ) {
    const { title: _t, tags: _tg, categories: _c, ...rest } = extra || {};
    const date = rest.date || existingDate || formatDateTime(new Date());
    return { ...rest, date };
  }

  private computePermalink(frontMatter: Record<string, any>, slug: string) {
    if (frontMatter?.permalink) return String(frontMatter.permalink);
    const parts = dateParts(frontMatter?.date);
    if (parts) return `/${parts.year}/${parts.month}/${parts.day}/${slug}/`;
    return `/${slug}/`;
  }

  private filename(slug: string) {
    return `${slug || `post-${Date.now()}`}.md`;
  }

  private githubPathFor(slug: string, status: string) {
    return status === 'published'
      ? `source/_posts/${this.filename(slug)}`
      : `source/_drafts/${this.filename(slug)}`;
  }

  private highlight(content: string, q: string): string {
    if (!content) return '';
    const text = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text.slice(0, 100) + '...';
    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + q.length + 30);
    const snippet = text.slice(start, end);
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (
      (start > 0 ? '...' : '') +
      snippet.replace(new RegExp(escaped, 'gi'), '<mark>$&</mark>') +
      (end < text.length ? '...' : '')
    );
  }

  private async writeGithub(
    post: { githubPath?: string | null; githubSha?: string | null },
    targetPath: string,
    content: string,
    message: string,
  ) {
    if (post.githubPath && post.githubPath !== targetPath && post.githubSha) {
      try {
        await this.github.deleteFile(post.githubPath, message, post.githubSha);
      } catch {
        /* ignore: file may already be gone */
      }
      return this.github.writeFile(targetPath, content, message);
    }
    return this.github.writeFile(
      targetPath,
      content,
      message,
      post.githubPath === targetPath ? post.githubSha || undefined : undefined,
    );
  }

  // ---- queries -----------------------------------------------------

  async list(query: ListQuery) {
    const status = query.status || 'all';
    const page = Math.max(parseInt(String(query.page || 1), 10) || 1, 1);
    const pageSize = Math.min(
      parseInt(String(query.pageSize || 12), 10) || 12,
      100,
    );
    const where: any = {};
    if (status === 'published') where.status = 'published';
    else if (status === 'draft') where.status = 'draft';
    else where.status = { not: 'discarded' };

    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword, mode: 'insensitive' } },
        { content: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, list: rows.map((r) => this.summary(r)) };
  }

  async get(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('文章不存在');
    return post;
  }

  async checkTitle(title: string, excludeId?: string) {
    const count = await this.prisma.post.count({
      where: { title, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return { exists: count > 0 };
  }

  async categories() {
    const posts = await this.prisma.post.findMany({
      where: { status: { not: 'discarded' } },
      select: { categories: true },
    });
    const map = new Map<string, number>();
    for (const p of posts)
      for (const c of p.categories) map.set(c, (map.get(c) || 0) + 1);
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  async tags() {
    const posts = await this.prisma.post.findMany({
      where: { status: { not: 'discarded' } },
      select: { tags: true },
    });
    const map = new Map<string, number>();
    for (const p of posts)
      for (const t of p.tags) map.set(t, (map.get(t) || 0) + 1);
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  async categoryPosts(name: string, query: ListQuery) {
    const page = Math.max(parseInt(String(query.page || 1), 10) || 1, 1);
    const pageSize = Math.min(
      parseInt(String(query.pageSize || 12), 10) || 12,
      100,
    );
    const where = { categories: { has: name }, status: { not: 'discarded' } };
    const [total, rows] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { category: name, total, list: rows.map((r) => this.summary(r)) };
  }

  async search(q: string) {
    if (!q) return [];
    const rows = await this.prisma.post.findMany({
      where: {
        status: { not: 'discarded' },
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return rows.map((p) => ({
      id: p.id,
      title: p.title,
      permalink: p.permalink,
      status: p.status,
      isPage: false,
      context: this.highlight(p.content, q),
    }));
  }

  // ---- mutations ---------------------------------------------------

  async create(dto: SavePostDto) {
    if (!dto.title) throw new BadRequestException('标题不能为空');
    const slug = dto.slug || slugify(dto.title) || `post-${Date.now()}`;
    const status = dto.status === 'published' ? 'published' : 'draft';
    const categories = normalizeList(dto.categories);
    const tags = normalizeList(dto.tags);
    const storedFm = this.buildStoredFrontMatter(dto.frontMatter);
    const fullFm = { ...storedFm, title: dto.title, tags, categories };
    const permalink = this.computePermalink(fullFm, slug);
    const githubPath = this.githubPathFor(slug, status);
    const content = serializeMarkdown(fullFm, dto.content || '');
    const sha = await this.github.writeFile(
      githubPath,
      content,
      `Create post: ${dto.title}`,
    );

    const post = await this.prisma.post.create({
      data: {
        title: dto.title,
        slug,
        content: dto.content || '',
        frontMatter: storedFm as any,
        categories,
        tags,
        status,
        githubPath,
        githubSha: sha,
        permalink,
        publishedAt: status === 'published' ? new Date() : null,
      },
    });
    return this.get(post.id);
  }

  async update(id: string, dto: SavePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('文章不存在');

    const title = dto.title ?? post.title;
    const slug = dto.slug ?? post.slug ?? slugify(title);
    const status = dto.status ?? post.status;
    const categories =
      dto.categories !== undefined ? normalizeList(dto.categories) : post.categories;
    const tags = dto.tags !== undefined ? normalizeList(dto.tags) : post.tags;
    const existingDate = (post.frontMatter as any)?.date;
    const storedFm = this.buildStoredFrontMatter(
      dto.frontMatter !== undefined ? dto.frontMatter : (post.frontMatter as any),
      existingDate,
    );
    const fullFm = { ...storedFm, title, tags, categories };
    const permalink = this.computePermalink(fullFm, slug);
    const newContent =
      dto.content !== undefined ? dto.content : post.content;
    const content = serializeMarkdown(fullFm, newContent);
    const targetPath = this.githubPathFor(slug, status);

    const sha = await this.writeGithub(
      post,
      targetPath,
      content,
      `Update post: ${title}`,
    );

    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        title,
        slug,
        content: newContent,
        frontMatter: storedFm as any,
        categories,
        tags,
        status,
        githubPath: targetPath,
        githubSha: sha,
        permalink,
        publishedAt:
          status === 'published' ? post.publishedAt || new Date() : null,
      },
    });
    return this.get(updated.id);
  }

  async setStatus(id: string, status: 'published' | 'draft') {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('文章不存在');
    if (post.status === status) return this.get(id);

    const fullFm = {
      ...(post.frontMatter as any),
      title: post.title,
      tags: post.tags,
      categories: post.categories,
    };
    const content = serializeMarkdown(fullFm, post.content);
    const targetPath = this.githubPathFor(post.slug || slugify(post.title), status);
    const sha = await this.writeGithub(
      post,
      targetPath,
      content,
      `${status === 'published' ? 'Publish' : 'Unpublish'} post: ${post.title}`,
    );
    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        status,
        githubPath: targetPath,
        githubSha: sha,
        publishedAt: status === 'published' ? post.publishedAt || new Date() : null,
      },
    });
    return this.get(updated.id);
  }

  async remove(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('文章不存在');

    if (post.githubPath && post.githubSha) {
      try {
        await this.github.deleteFile(
          post.githubPath,
          `Delete post: ${post.title}`,
          post.githubSha,
        );
      } catch {
        /* ignore */
      }
    }

    await this.prisma.recycleBin.create({
      data: {
        type: 'post',
        refId: post.id,
        title: post.title,
        data: post as any,
        githubPath: post.githubPath,
        githubSha: post.githubSha,
      },
    });
    await this.prisma.post.delete({ where: { id } });
    return { ok: true };
  }

  // ---- sync from the connected Hexo repo --------------------------

  async syncFromGithub() {
    const paths = ['source/_posts', 'source/_drafts'];
    let imported = 0;
    for (const dir of paths) {
      const files = await this.github.listDir(dir);
      for (const f of files) {
        if (f.type !== 'file' || !f.name.endsWith('.md')) continue;
        const file = await this.github.readFile(f.path);
        if (!file) continue;
        const { frontMatter, content } = parseMarkdown(file.content);
        const title = String(frontMatter.title || f.name.replace(/\.md$/, ''));
        const status = dir.includes('_drafts') ? 'draft' : 'published';
        const slug = String(
          frontMatter.slug || slugify(title) || f.name.replace(/\.md$/, ''),
        );
        const { title: _t, tags: _tg, categories: _c, ...rest } = frontMatter;
        const data = {
          title,
          slug,
          content,
          frontMatter: rest as any,
          categories: normalizeList(frontMatter.categories),
          tags: normalizeList(frontMatter.tags),
          status,
          githubPath: f.path,
          githubSha: file.sha,
          permalink:
            frontMatter.permalink ||
            this.computePermalink(frontMatter, slug),
        };
        const existing = await this.prisma.post.findFirst({
          where: { githubPath: f.path },
        });
        if (existing) {
          await this.prisma.post.update({ where: { id: existing.id }, data });
        } else {
          await this.prisma.post.create({ data });
        }
        imported++;
      }
    }
    return { imported };
  }
}
