import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../../github/github.service';
import { SettingsService } from '../settings/settings.service';
import {
  AddPluginsDto,
  InstallNpmThemeDto,
  InstallThemeDto,
} from './dto/theme.dto';

const WORKFLOW_PATH = '.github/workflows/install-theme.yml';

// 目标仓库里的主题安装工作流：clone 主题 → 加插件 → 提交推送。
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
      plugins:
        description: 'Extra npm plugins (comma separated, optional)'
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
      - name: Create config file
        run: |
          if [ ! -f "_config.\${{ github.event.inputs.theme_name }}.yml" ]; then
            touch "_config.\${{ github.event.inputs.theme_name }}.yml"
          fi
      - name: Add plugins to package.json
        env:
          PLUGINS: \${{ github.event.inputs.plugins }}
        run: |
          if [ -n "\$PLUGINS" ]; then
            node <<'EOF'
          const fs = require('fs');
          const plugins = (process.env.PLUGINS || '').split(',').map(s => s.trim()).filter(Boolean);
          const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
          p.dependencies = p.dependencies || {};
          for (const x of plugins) p.dependencies[x] = p.dependencies[x] || 'latest';
          fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\\n');
          EOF
          fi
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

  private async getPackageJson(): Promise<any> {
    const file = await this.github.readFile('package.json');
    if (!file) throw new NotFoundException('package.json 不存在');
    try {
      return JSON.parse(file.content);
    } catch {
      throw new BadRequestException('package.json 解析失败');
    }
  }

  private async savePackageJson(
    pkg: any,
    message: string,
  ): Promise<string | undefined> {
    const file = await this.github.readFile('package.json');
    if (!file) throw new NotFoundException('package.json 不存在');
    const content = JSON.stringify(pkg, null, 2) + '\n';
    return this.github.writeFile('package.json', content, message, file.sha);
  }

  // ---- 配置草稿（先存数据库，确认后再推 GitHub） -----------------

  private draftKey(name: string): string {
    return `configDraft:theme:${name}`;
  }

  private async getDraft(name: string): Promise<string | null> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: this.draftKey(name) },
    });
    return (row?.value as any)?.content ?? null;
  }

  private async saveDraft(name: string, content: string): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key: this.draftKey(name) },
      create: { key: this.draftKey(name), value: { content } as any },
      update: { value: { content } as any },
    });
  }

  private async deleteDraft(name: string): Promise<void> {
    await this.prisma.systemSetting.deleteMany({
      where: { key: this.draftKey(name) },
    });
  }

  /** 已安装主题：themes/ 目录（git）+ package.json 里的 hexo-theme-*（npm）。 */
  async installed() {
    const map = new Map<string, { name: string; mode: string }>();

    const gitEntries = await this.github.listDir('themes');
    for (const e of gitEntries) {
      if (e.type === 'dir') map.set(e.name, { name: e.name, mode: 'git' });
    }

    try {
      const pkg = await this.getPackageJson();
      for (const dep of Object.keys(pkg.dependencies || {})) {
        if (dep.startsWith('hexo-theme-')) {
          const name = dep.slice('hexo-theme-'.length);
          if (!map.has(name)) map.set(name, { name, mode: 'npm' });
        }
      }
    } catch {
      /* package.json 不可读时忽略 */
    }

    return Array.from(map.values());
  }

  /** 已安装插件：package.json 里 hexo-* 依赖（不含 hexo-theme-*）。 */
  async listPlugins() {
    const pkg = await this.getPackageJson();
    return Object.entries(pkg.dependencies || {})
      .filter(
        ([name]) => name.startsWith('hexo-') && !name.startsWith('hexo-theme-'),
      )
      .map(([name, version]) => ({ name, version }));
  }

  async addPlugins(dto: AddPluginsDto) {
    const plugins = (dto.plugins || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!plugins.length) throw new BadRequestException('请提供插件包名');

    const pkg = await this.getPackageJson();
    for (const p of plugins) {
      if (!pkg.dependencies[p]) pkg.dependencies[p] = 'latest';
    }
    await this.savePackageJson(pkg, `Add plugins: ${plugins.join(', ')}`);
    return { plugins };
  }

  async removePlugin(name: string) {
    const pkg = await this.getPackageJson();
    if (!pkg.dependencies?.[name]) {
      throw new BadRequestException(`插件「${name}」不存在`);
    }
    delete pkg.dependencies[name];
    await this.savePackageJson(pkg, `Remove plugin: ${name}`);
    return { plugin: name };
  }

  async current() {
    const file = await this.github.readFile('_config.yml');
    if (!file) throw new NotFoundException('_config.yml 不存在');
    const m = /^theme:\s*(.+)$/m.exec(file.content);
    const theme = m ? m[1].trim().replace(/['"]/g, '') : '';
    return { theme };
  }

  private async writeThemeField(name: string): Promise<string | undefined> {
    const file = await this.github.readFile('_config.yml');
    if (!file) throw new NotFoundException('_config.yml 不存在');

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
    return this.github.writeFile(
      '_config.yml',
      content,
      `Switch theme: ${name}`,
      file.sha,
    );
  }

  async switchTheme(name: string) {
    const sha = await this.writeThemeField(name);
    return { theme: name, sha };
  }

  private deriveThemeName(repo: string): string {
    let name = repo;
    if (name.startsWith('hexo-theme-')) name = name.slice('hexo-theme-'.length);
    return name || repo;
  }

  private async ensureWorkflow() {
    const existing = await this.github.readFile(WORKFLOW_PATH);
    if (existing) return;
    await this.github.writeFile(
      WORKFLOW_PATH,
      INSTALL_THEME_WORKFLOW,
      'Add theme install workflow',
    );
  }

  /** git 克隆方式安装主题（GitHub Actions 执行），可附带 npm 插件。 */
  async install(dto: InstallThemeDto) {
    const m = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(
      (dto.url || '').trim(),
    );
    if (!m) throw new BadRequestException('无效的 GitHub 仓库 URL');
    const owner = m[1];
    const repo = m[2];
    const themeName = dto.name?.trim() || this.deriveThemeName(repo);
    const themeBranch = dto.branch?.trim() || '';
    const plugins = (dto.plugins || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(',');

    await this.ensureWorkflow();

    const cfg = await this.settings.getGithubConfig();
    const branch = cfg.branch || 'master';

    let dispatched = false;
    let lastErr: any = null;
    for (let i = 0; i < 3 && !dispatched; i++) {
      try {
        await this.github.dispatchWorkflow('install-theme.yml', branch, {
          theme_url: `https://github.com/${owner}/${repo}`,
          theme_name: themeName,
          theme_branch: themeBranch,
          plugins,
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

    const runs = await this.github.listWorkflowRuns('install-theme.yml');
    const latest = runs[0];

    return {
      theme: themeName,
      runId: latest?.id,
      runUrl: latest?.html_url || null,
      plugins: dto.plugins ? (dto.plugins || '').split(',').map((s) => s.trim()).filter(Boolean) : [],
      message: '已触发 GitHub Actions 安装任务',
    };
  }

  async getInstallStatus(runId: number) {
    const run = await this.github.getWorkflowRun(runId);
    const status = run.status;
    const conclusion = run.conclusion;

    let mappedStatus: string;
    let progress: number;
    if (status === 'completed') {
      mappedStatus = conclusion === 'success' ? 'completed' : 'failed';
      progress = 100;
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

  /** npm 安装主题：改 package.json 加主题包与插件、创建配置文件、切换 theme。 */
  async installNpm(dto: InstallNpmThemeDto) {
    const pkgName = dto.package.trim();
    const themeName = dto.name.trim();
    const plugins = (dto.plugins || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const pkg = await this.getPackageJson();
    const targets = [pkgName, ...plugins];
    for (const p of targets) {
      if (!pkg.dependencies[p]) pkg.dependencies[p] = 'latest';
    }
    await this.savePackageJson(pkg, `Add theme ${pkgName}`);

    const configPath = `_config.${themeName}.yml`;
    const existingConfig = await this.github.readFile(configPath);
    if (!existingConfig) {
      await this.github.writeFile(configPath, '', `Create ${configPath}`);
    }

    await this.writeThemeField(themeName);

    return {
      theme: themeName,
      package: pkgName,
      plugins,
      configPath,
    };
  }

  /** 卸载主题：themes/<name>（git）或 hexo-theme-<name>（npm）。 */
  async uninstall(name: string) {
    let removed = false;
    const result: any = { theme: name };

    // 1. git 模式
    const cfg = await this.settings.getGithubConfig();
    const branch = cfg.branch || 'master';
    const headSha = await this.github.getBranchHeadSha(branch);
    const rootTreeSha = await this.github.getCommitTreeSha(headSha);
    const rootEntries = await this.github.getTree(rootTreeSha);
    const themesTreeSha = rootEntries.find(
      (e) => e.path === 'themes' && e.type === 'tree',
    )?.sha;

    if (themesTreeSha) {
      const themesEntries = await this.github.getTree(themesTreeSha);
      if (themesEntries.some((e) => e.path === name)) {
        const remaining = themesEntries
          .filter((e) => e.path !== name)
          .map((e) => ({
            path: e.path,
            mode: e.mode,
            type: e.type,
            sha: e.sha,
          }));
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
        removed = true;
        result.commit = commitSha;
      }
    }

    // 2. npm 模式
    const pkg = await this.getPackageJson();
    const npmName = `hexo-theme-${name}`;
    if (pkg.dependencies?.[npmName]) {
      delete pkg.dependencies[npmName];
      await this.savePackageJson(pkg, `Uninstall theme: ${name}`);
      removed = true;
      result.package = npmName;
    }

    if (!removed) throw new BadRequestException(`主题「${name}」不存在`);

    // 3. 删除主题配置文件（GitHub）+ 草稿与快照（数据库）
    const configPath = `_config.${name}.yml`;
    const configFile = await this.github.readFile(configPath);
    if (configFile) {
      await this.github.deleteFile(
        configPath,
        `Delete ${configPath}`,
        configFile.sha,
      );
      result.configDeleted = true;
    }
    await this.deleteDraft(name);
    await this.prisma.configSnapshot.deleteMany({
      where: { scope: `file:${configPath}` },
    });

    return result;
  }

  async getConfig(name: string) {
    const path = `_config.${name}.yml`;
    const file = await this.github.readFile(path);
    const draft = await this.getDraft(name);
    return {
      path,
      content: file?.content ?? '',
      sha: file?.sha ?? null,
      draft,
      hasDraft: draft !== null,
    };
  }

  /** 保存配置草稿到数据库（不推 GitHub）。 */
  async saveConfigDraft(name: string, content: string) {
    await this.saveDraft(name, content);
    return { name, draft: true };
  }

  /** 把草稿发布到 GitHub（自动快照后写文件，再清草稿）。 */
  async publishConfigDraft(name: string) {
    const draft = await this.getDraft(name);
    if (draft === null) throw new BadRequestException('没有待发布的草稿');

    const path = `_config.${name}.yml`;
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
      `Update theme config: ${name}`,
      existing?.sha,
    );
    await this.deleteDraft(name);
    return { path, sha, published: true };
  }

  /** 丢弃未发布的草稿。 */
  async discardConfigDraft(name: string) {
    await this.deleteDraft(name);
    return { name, discarded: true };
  }
}
