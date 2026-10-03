import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GithubService } from '../../github/github.service.js';
import {
  formatDateTime,
  frontMatterToYaml,
  parseMarkdown,
  serializeMarkdown,
  slugify,
  yamlToFrontMatter,
} from '../../common/utils/markdown.util.js';
import { SavePageDto } from './dto/pages.dto.js';

interface ListQuery {
  status?: string;
  page?: number;
  pageSize?: number;
  keyword?: string;
}

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
  ) {}

  private summary(p: any) {
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      permalink: p.permalink,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      frontMatter: p.frontMatter,
    };
  }

  private buildStoredFrontMatter(
    extra: Record<string, any> | undefined,
    existingDate?: string,
  ) {
    const { title: _t, ...rest } = extra || {};
    const date = rest.date || existingDate || formatDateTime(new Date());
    return { ...rest, date };
  }

  /** 优先使用 frontMatterYaml（原始 YAML），否则用 frontMatter JSON。 */
  private resolveFrontMatter(
    dto: SavePageDto,
    fallback?: Record<string, any>,
  ): Record<string, any> | undefined {
    if (dto.frontMatterYaml !== undefined) {
      return yamlToFrontMatter(dto.frontMatterYaml);
    }
    return dto.frontMatter !== undefined ? dto.frontMatter : fallback;
  }

  private githubPathFor(slug: string, status: string) {
    return status === 'published'
      ? `source/${slug}/index.md`
      : `source/_drafts/${slug}.md`;
  }

  private async writeGithub(
    page: { githubPath?: string | null; githubSha?: string | null },
    targetPath: string,
    content: string,
    message: string,
  ) {
    if (page.githubPath && page.githubPath !== targetPath && page.githubSha) {
      try {
        await this.github.deleteFile(page.githubPath, message, page.githubSha);
      } catch {
        /* ignore */
      }
      return this.github.writeFile(targetPath, content, message);
    }
    return this.github.writeFile(
      targetPath,
      content,
      message,
      page.githubPath === targetPath ? page.githubSha || undefined : undefined,
    );
  }

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
      this.prisma.page.count({ where }),
      this.prisma.page.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, list: rows.map((r) => this.summary(r)) };
  }

  async get(id: string) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('页面不存在');
    return {
      ...page,
      frontMatterYaml: frontMatterToYaml(page.frontMatter as any),
    };
  }

  async create(dto: SavePageDto) {
    if (!dto.title) throw new BadRequestException('标题不能为空');
    const slug = dto.slug || slugify(dto.title) || `page-${Date.now()}`;
    const status = dto.status === 'published' ? 'published' : 'draft';
    const storedFm = this.buildStoredFrontMatter(this.resolveFrontMatter(dto));
    const fullFm = { ...storedFm, title: dto.title };
    const permalink = `/${slug}/`;
    const githubPath = this.githubPathFor(slug, status);
    const content = serializeMarkdown(fullFm, dto.content || '');
    const sha = await this.github.writeFile(
      githubPath,
      content,
      `Create page: ${dto.title}`,
    );

    const page = await this.prisma.page.create({
      data: {
        title: dto.title,
        slug,
        content: dto.content || '',
        frontMatter: storedFm as any,
        status,
        githubPath,
        githubSha: sha,
        permalink,
        publishedAt: status === 'published' ? new Date() : null,
      },
    });
    return this.get(page.id);
  }

  async update(id: string, dto: SavePageDto) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('页面不存在');

    const title = dto.title ?? page.title;
    const slug = dto.slug ?? page.slug ?? slugify(title);
    const status = dto.status ?? page.status;
    const existingDate = (page.frontMatter as any)?.date;
    const storedFm = this.buildStoredFrontMatter(
      this.resolveFrontMatter(dto, page.frontMatter as any),
      existingDate,
    );
    const fullFm = { ...storedFm, title };
    const permalink = `/${slug}/`;
    const newContent = dto.content !== undefined ? dto.content : page.content;
    const content = serializeMarkdown(fullFm, newContent);
    const targetPath = this.githubPathFor(slug, status);
    const sha = await this.writeGithub(
      page,
      targetPath,
      content,
      `Update page: ${title}`,
    );

    const updated = await this.prisma.page.update({
      where: { id },
      data: {
        title,
        slug,
        content: newContent,
        frontMatter: storedFm as any,
        status,
        githubPath: targetPath,
        githubSha: sha,
        permalink,
        publishedAt:
          status === 'published' ? page.publishedAt || new Date() : null,
      },
    });
    return this.get(updated.id);
  }

  async setStatus(id: string, status: 'published' | 'draft') {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('页面不存在');
    if (page.status === status) return this.get(id);

    const fullFm = { ...(page.frontMatter as any), title: page.title };
    const content = serializeMarkdown(fullFm, page.content);
    const targetPath = this.githubPathFor(page.slug || slugify(page.title), status);
    const sha = await this.writeGithub(
      page,
      targetPath,
      content,
      `${status === 'published' ? 'Publish' : 'Unpublish'} page: ${page.title}`,
    );
    const updated = await this.prisma.page.update({
      where: { id },
      data: {
        status,
        githubPath: targetPath,
        githubSha: sha,
        publishedAt: status === 'published' ? page.publishedAt || new Date() : null,
      },
    });
    return this.get(updated.id);
  }

  async remove(id: string) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('页面不存在');

    if (page.githubPath && page.githubSha) {
      try {
        await this.github.deleteFile(
          page.githubPath,
          `Delete page: ${page.title}`,
          page.githubSha,
        );
      } catch {
        /* ignore */
      }
    }
    await this.prisma.recycleBin.create({
      data: {
        type: 'page',
        refId: page.id,
        title: page.title,
        data: page as any,
        githubPath: page.githubPath,
        githubSha: page.githubSha,
      },
    });
    await this.prisma.page.delete({ where: { id } });
    return { ok: true };
  }

  async syncFromGithub() {
    let imported = 0;
    const entries = await this.github.listDir('source');
    for (const entry of entries) {
      let path = '';
      if (entry.type === 'dir') {
        path = `${entry.path}/index.md`;
      } else if (entry.type === 'file' && entry.name.endsWith('.md')) {
        path = entry.path;
      } else {
        continue;
      }
      const file = await this.github.readFile(path);
      if (!file) continue;
      const { frontMatter, content } = parseMarkdown(file.content);
      const title = String(frontMatter.title || entry.name.replace(/\.md$/, ''));
      const slug = String(
        frontMatter.slug || slugify(title) || entry.name.replace(/\.md$/, ''),
      );
      const { title: _t, ...rest } = frontMatter;
      const data = {
        title,
        slug,
        content,
        frontMatter: rest as any,
        status: 'published',
        githubPath: path,
        githubSha: file.sha,
        permalink: frontMatter.permalink || `/${slug}/`,
      };
      const existing = await this.prisma.page.findFirst({
        where: { githubPath: path },
      });
      if (existing) {
        await this.prisma.page.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.page.create({ data });
      }
      imported++;
    }
    return { imported };
  }
}
