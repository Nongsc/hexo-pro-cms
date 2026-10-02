import { Injectable, NotFoundException } from '@nestjs/common';
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

  async getConfig(path: string) {
    const file = await this.github.readFile(path);
    if (!file) throw new NotFoundException(`配置文件不存在: ${path}`);
    return { path, content: file.content, sha: file.sha };
  }

  async saveConfig(path: string, content: string, note?: string) {
    const existing = await this.github.readFile(path);
    if (existing) {
      await this.prisma.configSnapshot.create({
        data: {
          scope: `file:${path}`,
          content: existing.content,
          note: note || '保存前自动快照',
        },
      });
    }
    const sha = await this.github.writeFile(
      path,
      content,
      `Update config: ${path}`,
      existing?.sha,
    );
    return { path, sha };
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
