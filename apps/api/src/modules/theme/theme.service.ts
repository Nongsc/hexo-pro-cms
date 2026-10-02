import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { SettingsService } from '../settings/settings.service';
import {
  InstallThemeDto,
  SaveThemeConfigDto,
} from './dto/theme.dto';

const WORKFLOW_PATH = '.github/workflows/install-theme.yml';

// 目标仓库里的主题安装工作流：clone 主题 → 拷到 themes/ → 提交推送。
const INSTALL_THEME_WORKFLOW = `name: Install Theme
on:
  workflow_dispatch:
    inputs:
      theme_url:
        description: 'Theme repo URL'
        required: true
      theme_name:
        description: 'Theme directory name'
        required: true
      theme_branch:
        description: 'Theme branch (empty = default)'
        required: false
        default: ''
jobs:
  install:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - name: Clone theme
        run: |
          rm -rf "themes/\${{ github.event.inputs.theme_name }}"
          if [ -n "\${{ github.event.inputs.theme_branch }}" ]; then
            git clone --depth 1 --branch "\${{ github.event.inputs.theme_branch }}" "\${{ github.event.inputs.theme_url }}" "themes/\${{ github.event.inputs.theme_name }}"
          else
            git clone --depth 1 "\${{ github.event.inputs.theme_url }}" "themes/\${{ github.event.inputs.theme_name }}"
          fi
          rm -rf "themes/\${{ github.event.inputs.theme_name }}/.git"
      - name: Commit & push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -A
          git commit -m "Install theme: \${{ github.event.inputs.theme_name }}" || echo "no changes"
          git push
`;

@Injectable()
export class ThemeService {
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

  /** 确保目标仓库里存在主题安装工作流。 */
  private async ensureWorkflow() {
    const existing = await this.github.readFile(WORKFLOW_PATH);
    if (existing) return;
    await this.github.writeFile(
      WORKFLOW_PATH,
      INSTALL_THEME_WORKFLOW,
      'Add theme install workflow',
    );
  }

  /** 触发 GitHub Actions 安装主题，返回 workflow run 信息。 */
  async install(dto: InstallThemeDto) {
    const m = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(
      (dto.url || '').trim(),
    );
    if (!m) throw new BadRequestException('无效的 GitHub 仓库 URL');
    const owner = m[1];
    const repo = m[2];
    const themeName = dto.name?.trim() || this.deriveThemeName(repo);
    const themeBranch = dto.branch?.trim() || '';

    await this.ensureWorkflow();

    const cfg = await this.settings.getGithubConfig();
    const branch = cfg.branch || 'master';

    // 工作流刚创建时 GitHub 可能尚未注册，重试几次
    let dispatched = false;
    let lastErr: any = null;
    for (let i = 0; i < 3 && !dispatched; i++) {
      try {
        await this.github.dispatchWorkflow('install-theme.yml', branch, {
          theme_url: `https://github.com/${owner}/${repo}`,
          theme_name: themeName,
          theme_branch: themeBranch,
        });
        dispatched = true;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (!dispatched) {
      throw new BadRequestException(
        `触发安装工作流失败：${lastErr?.message || lastErr}`,
      );
    }

    // 找到刚触发的 run
    const runs = await this.github.listWorkflowRuns('install-theme.yml');
    const latest = runs[0];

    return {
      theme: themeName,
      runId: latest?.id,
      runUrl: latest?.html_url || null,
      message: '已触发 GitHub Actions 安装任务',
    };
  }

  async getInstallStatus(runId: number) {
    const run = await this.github.getWorkflowRun(runId);
    const status = run.status; // queued | in_progress | completed
    const conclusion = run.conclusion; // success | failure | ...

    let mappedStatus: string;
    let progress: number;
    if (status === 'completed') {
      mappedStatus = conclusion === 'success' ? 'completed' : 'failed';
      progress = conclusion === 'success' ? 100 : 100;
    } else if (status === 'in_progress') {
      mappedStatus = 'running';
      progress = 60;
    } else {
      mappedStatus = 'running';
      progress = 10;
    }

    return {
      status: mappedStatus,
      progress,
      conclusion,
      runUrl: run.html_url,
      runId,
    };
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
