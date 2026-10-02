import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { serializeMarkdown, slugify } from '../../common/utils/markdown.util';

@Injectable()
export class RecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
  ) {}

  list() {
    return this.prisma.recycleBin.findMany({ orderBy: { deletedAt: 'desc' } });
  }

  async stats() {
    const [post, page, image] = await Promise.all([
      this.prisma.recycleBin.count({ where: { type: 'post' } }),
      this.prisma.recycleBin.count({ where: { type: 'page' } }),
      this.prisma.recycleBin.count({ where: { type: 'image' } }),
    ]);
    return { post, page, image, total: post + page + image };
  }

  async restore(id: string) {
    const item = await this.prisma.recycleBin.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('回收站记录不存在');
    const data = (item.data || {}) as any;

    if (item.type === 'post') {
      const fullFm = {
        ...(data.frontMatter || {}),
        title: data.title,
        tags: data.tags || [],
        categories: data.categories || [],
      };
      const content = serializeMarkdown(fullFm, data.content || '');
      const path =
        data.githubPath ||
        `source/${data.status === 'draft' ? '_drafts/' : '_posts/'}${data.slug || slugify(data.title) || Date.now()}.md`;
      const sha = await this.github.writeFile(
        path,
        content,
        `Restore post: ${data.title}`,
      );
      await this.prisma.post.create({
        data: {
          id: data.id,
          title: data.title,
          slug: data.slug,
          content: data.content || '',
          frontMatter: data.frontMatter,
          categories: data.categories || [],
          tags: data.tags || [],
          status: data.status || 'draft',
          githubPath: path,
          githubSha: sha,
          permalink: data.permalink,
        },
      });
    } else if (item.type === 'page') {
      const fullFm = { ...(data.frontMatter || {}), title: data.title };
      const content = serializeMarkdown(fullFm, data.content || '');
      const path =
        data.githubPath ||
        `source/${data.slug || slugify(data.title) || Date.now()}/index.md`;
      const sha = await this.github.writeFile(
        path,
        content,
        `Restore page: ${data.title}`,
      );
      await this.prisma.page.create({
        data: {
          id: data.id,
          title: data.title,
          slug: data.slug,
          content: data.content || '',
          frontMatter: data.frontMatter,
          status: data.status || 'published',
          githubPath: path,
          githubSha: sha,
          permalink: data.permalink,
        },
      });
    } else {
      throw new BadRequestException('该类型的记录无法恢复');
    }

    await this.prisma.recycleBin.delete({ where: { id } });
    return { ok: true };
  }

  async remove(id: string) {
    await this.prisma.recycleBin.deleteMany({ where: { id } });
    return { ok: true };
  }

  async empty() {
    await this.prisma.recycleBin.deleteMany({});
    return { ok: true };
  }
}
