import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { SettingsService } from '../settings/settings.service';
import {
  InstallThemeDto,
  SaveThemeConfigDto,
} from './dto/theme.dto';

interface ThemeNode {
  files: Map<string, string>; // name -> blob sha
  dirs: Map<string, ThemeNode>;
}

export interface InstallJob {
  id: string;
  status: 'pending' | 'fetching' | 'building' | 'committing' | 'completed' | 'failed';
  progress: number;
  theme: string;
  commit?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ThemeService {
  private readonly jobs = new Map<string, InstallJob>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
    private readonly settings: SettingsService,
  ) {}

  async installed() {
    const entries = await this.github.listDir('themes');
    return entries
      .filter((e) => e.type === 'dir')
      .map((e) => ({ name: e.name, path: e.path }));
  }

  async current() {
    const file = await this.github.readFile('_config.yml');
    if (!file) throw new NotFoundException('_config.yml 不存在');
    const m = /^theme:\s*(.+)$/m.exec(file.content);
    const theme = m ? m[1].trim().replace(/['"]/g, '') : '';
    return { theme };
  }

  async switchTheme(name: string) {
    const file = await this.github.readFile('_config.yml');
    if (!file) throw new NotFoundException('_config.yml 不存在');

    const entries = await this.github.listDir(`themes/${name}`);
    if (!entries.length) {
      throw new BadRequestException(`主题「${name}」不存在，请先安装`);
    }

    let content = file.content;
    if (/^theme:\s*.*$/m.test(content)) {
      content = content.replace(/^theme:\s*.*$/m, `theme: ${name}`);
    } else {
      content += `\ntheme: ${name}\n`;
    }

    await this.prisma.configSnapshot.create({
      data: {
        scope: 'file:_config.yml',
        content: file.content,
        note: `切换主题到 ${name}`,
      },
    });
    const sha = await this.github.writeFile(
      '_config.yml',
      content,
      `Switch theme: ${name}`,
      file.sha,
    );
    return { theme: name, sha };
  }

  private deriveThemeName(repo: string): string {
    let name = repo;
    if (name.startsWith('hexo-theme-')) name = name.slice('hexo-theme-'.length);
    return name || repo;
  }

  private buildNode(files: { path: string; sha: string }[]): ThemeNode {
    const root: ThemeNode = { files: new Map(), dirs: new Map() };
    for (const f of files) {
      const parts = f.path.split('/');
      let cur = root;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (i === parts.length - 1) {
          cur.files.set(p, f.sha);
        } else {
          if (!cur.dirs.has(p)) {
            cur.dirs.set(p, { files: new Map(), dirs: new Map() });
          }
          cur = cur.dirs.get(p)!;
        }
      }
    }
    return root;
  }

  private async createNodeTree(node: ThemeNode): Promise<string> {
    const entries: { path: string; mode: string; type: string; sha: string }[] =
      [];
    for (const [name, sha] of node.files) {
      entries.push({ path: name, mode: '100644', type: 'blob', sha });
    }
    for (const [name, child] of node.dirs) {
      const childSha = await this.createNodeTree(child);
      entries.push({ path: name, mode: '040000', type: 'tree', sha: childSha });
    }
    return this.github.createTree(undefined, entries);
  }

  private updateJob(jobId: string, patch: Partial<InstallJob>) {
    const job = this.jobs.get(jobId);
    if (job) Object.assign(job, patch, { updatedAt: new Date() });
  }

  /** 立即返回 jobId，安装任务在后台执行。 */
  install(dto: InstallThemeDto): { jobId: string; theme: string } {
    const m = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(
      (dto.url || '').trim(),
    );
    if (!m) throw new BadRequestException('无效的 GitHub 仓库 URL');
    const owner = m[1];
    const repo = m[2];
    const themeName = dto.name?.trim() || this.deriveThemeName(repo);
    const branch = dto.branch?.trim() || undefined;

    const jobId = randomUUID();
    this.jobs.set(jobId, {
      id: jobId,
      status: 'pending',
      progress: 0,
      theme: themeName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    void this.runInstall(jobId, owner, repo, themeName, branch);
    return { jobId, theme: themeName };
  }

  getInstallStatus(jobId: string): InstallJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException('安装任务不存在');
    return job;
  }

  private async runInstall(
    jobId: string,
    owner: string,
    repo: string,
    themeName: string,
    branch: string | undefined,
  ) {
    try {
      // 1. 解析默认分支 + 拉取文件树
      this.updateJob(jobId, { status: 'fetching', progress: 3 });
      let ref = branch;
      if (!ref) {
        try {
          ref = await this.github.getRemoteDefaultBranch(owner, repo);
        } catch {
          ref = 'master';
        }
      }
      const tree = await this.github.getRemoteTreeRecursive(owner, repo, ref);
      const blobEntries = tree.filter((e) => e.type === 'blob');
      if (!blobEntries.length) {
        throw new BadRequestException('主题仓库内容为空');
      }

      // 2. 并发拉取内容 + 在目标仓库重建 blob（最耗时）
      this.updateJob(jobId, { status: 'building', progress: 8 });
      const total = blobEntries.length;
      const CONCURRENCY = 30;
      const rebuilt: { path: string; sha: string }[] = [];
      let done = 0;
      for (let i = 0; i < total; i += CONCURRENCY) {
        const chunk = blobEntries.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          chunk.map(async (b) => {
            const content = await this.github.getRemoteBlobContent(
              owner,
              repo,
              b.sha,
            );
            const sha = await this.github.createBlob(content);
            return { path: b.path, sha };
          }),
        );
        rebuilt.push(...results);
        done += chunk.length;
        this.updateJob(jobId, {
          progress: 8 + Math.round((done / total) * 77),
        });
      }

      // 3. 构建主题子树
      this.updateJob(jobId, { status: 'building', progress: 88 });
      const themeTreeSha = await this.createNodeTree(this.buildNode(rebuilt));

      // 4. 提交 + 更新分支
      this.updateJob(jobId, { status: 'committing', progress: 95 });
      const cfg = await this.settings.getGithubConfig();
      const targetBranch = cfg.branch || 'master';
      const headSha = await this.github.getBranchHeadSha(targetBranch);
      const rootTreeSha = await this.github.getCommitTreeSha(headSha);
      const rootEntries = await this.github.getTree(rootTreeSha);
      const themesTreeSha = rootEntries.find(
        (e) => e.path === 'themes' && e.type === 'tree',
      )?.sha;

      const newThemesSha = await this.github.createTree(themesTreeSha, [
        { path: themeName, mode: '040000', type: 'tree', sha: themeTreeSha },
      ]);
      const newRootSha = await this.github.createTree(rootTreeSha, [
        { path: 'themes', mode: '040000', type: 'tree', sha: newThemesSha },
      ]);
      const commitSha = await this.github.createCommit(
        `Install theme: ${themeName} (${owner}/${repo})`,
        newRootSha,
        headSha,
      );
      await this.github.updateBranchRef(targetBranch, commitSha);

      this.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        commit: commitSha,
      });
    } catch (err: any) {
      this.updateJob(jobId, {
        status: 'failed',
        error: err?.message || '安装失败',
      });
    }
  }

  async uninstall(name: string) {
    const cfg = await this.settings.getGithubConfig();
    const branch = cfg.branch || 'master';
    const headSha = await this.github.getBranchHeadSha(branch);
    const rootTreeSha = await this.github.getCommitTreeSha(headSha);
    const rootEntries = await this.github.getTree(rootTreeSha);
    const themesTreeSha = rootEntries.find(
      (e) => e.path === 'themes' && e.type === 'tree',
    )?.sha;
    if (!themesTreeSha) throw new BadRequestException('themes 目录不存在');

    const themesEntries = await this.github.getTree(themesTreeSha);
    if (!themesEntries.some((e) => e.path === name)) {
      throw new BadRequestException(`主题「${name}」不存在`);
    }

    const remaining = themesEntries
      .filter((e) => e.path !== name)
      .map((e) => ({ path: e.path, mode: e.mode, type: e.type, sha: e.sha }));

    const newThemesSha = await this.github.createTree(undefined, remaining);
    const newRootSha = await this.github.createTree(rootTreeSha, [
      { path: 'themes', mode: '040000', type: 'tree', sha: newThemesSha },
    ]);
    const commitSha = await this.github.createCommit(
      `Uninstall theme: ${name}`,
      newRootSha,
      headSha,
    );
    await this.github.updateBranchRef(branch, commitSha);
    return { theme: name, commit: commitSha };
  }

  async getConfig(name: string) {
    const path = `_config.${name}.yml`;
    const file = await this.github.readFile(path);
    if (!file) throw new NotFoundException(`主题配置文件不存在: ${path}`);
    return { path, content: file.content, sha: file.sha };
  }

  async saveConfig(dto: SaveThemeConfigDto) {
    const path = `_config.${dto.name}.yml`;
    const existing = await this.github.readFile(path);
    if (existing) {
      await this.prisma.configSnapshot.create({
        data: {
          scope: `file:${path}`,
          content: existing.content,
          note: dto.note || '保存前自动快照',
        },
      });
    }
    const sha = await this.github.writeFile(
      path,
      dto.content,
      `Update theme config: ${dto.name}`,
      existing?.sha,
    );
    return { path, sha };
  }
}
