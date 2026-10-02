import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';

@Injectable()
export class ConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
  ) {}

  async listFiles() {
    const entries = await this.github.listDir('');
    return entries
      .filter(
        (e) => e.type === 'file' && /^_config[^/]*\.ya?ml$/.test(e.name),
      )
      .map((e) => ({ name: e.name, path: e.path }));
  }

  // ---- 草稿（先存数据库，确认后再推 GitHub） -----------------

  private draftKey(path: string): string {
    return `configDraft:site:${path}`;
  }

  private async getDraft(path: string): Promise<string | null> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: this.draftKey(path) },
    });
    return (row?.value as any)?.content ?? null;
  }

  private async saveDraft(path: string, content: string): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key: this.draftKey(path) },
      create: { key: this.draftKey(path), value: { content } as any },
      update: { value: { content } as any },
    });
  }

  private async deleteDraft(path: string): Promise<void> {
    await this.prisma.systemSetting.deleteMany({
      where: { key: this.draftKey(path) },
    });
  }

  async getConfig(path: string) {
    const file = await this.github.readFile(path);
    if (!file) throw new NotFoundException(`配置文件不存在: ${path}`);
    const draft = await this.getDraft(path);
    return {
      path,
      content: file.content,
      sha: file.sha,
      draft,
      hasDraft: draft !== null,
    };
  }

  /** 保存配置草稿到数据库（不推 GitHub）。 */
  async saveConfigDraft(path: string, content: string) {
    await this.saveDraft(path, content);
    return { path, draft: true };
  }

  /** 把草稿发布到 GitHub（自动快照后写文件，再清草稿）。 */
  async publishConfigDraft(path: string) {
    const draft = await this.getDraft(path);
    if (draft === null) throw new BadRequestException('没有待发布的草稿');

    const existing = await this.github.readFile(path);
    if (existing) {
      await this.prisma.configSnapshot.create({
        data: {
          scope: `file:${path}`,
          content: existing.content,
          note: '发布草稿前自动快照',
        },
      });
    }
    const sha = await this.github.writeFile(
      path,
      draft,
      `Update config: ${path}`,
      existing?.sha,
    );
    await this.deleteDraft(path);
    return { path, sha, published: true };
  }

  /** 丢弃未发布的草稿。 */
  async discardConfigDraft(path: string) {
    await this.deleteDraft(path);
    return { path, discarded: true };
  }

  async snapshots(scope: string) {
    return this.prisma.configSnapshot.findMany({
      where: { scope },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, scope: true, content: true, note: true, createdAt: true },
    });
  }

  async rollback(snapshotId: string) {
    const snap = await this.prisma.configSnapshot.findUnique({
      where: { id: snapshotId },
    });
    if (!snap) throw new NotFoundException('快照不存在');
    const path = snap.scope.replace(/^file:/, '');
    const existing = await this.github.readFile(path);
    const sha = await this.github.writeFile(
      path,
      snap.content,
      `Rollback config: ${path}`,
      existing?.sha,
    );
    return { path, sha };
  }
}
