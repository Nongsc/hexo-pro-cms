import { BadRequestException, Injectable } from '@nestjs/common';
import { SettingsService } from '../modules/settings/settings.service';
import { GithubConfig } from '../config/types';

function encodePath(path: string): string {
  return path.split('/').map((s) => encodeURIComponent(s)).join('/');
}

export interface RepoFile {
  content: string;
  sha: string;
}

@Injectable()
export class GithubService {
  private readonly apiBase = 'https://api.github.com';

  constructor(private readonly settings: SettingsService) {}

  private async auth(): Promise<GithubConfig> {
    const cfg = await this.settings.getGithubConfig();
    if (!cfg.token || !cfg.owner || !cfg.repo) {
      throw new BadRequestException(
        '请先在系统设置中配置 GitHub 连接（Token、仓库名）',
      );
    }
    return cfg;
  }

  private headers(cfg: GithubConfig) {
    return {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'hexo-pro-cms',
    };
  }

  private async parse(res: Response): Promise<any> {
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      throw new BadRequestException(
        `GitHub API 错误 (${res.status}): ${data?.message || text}`,
      );
    }
    return data;
  }

  async readFile(path: string): Promise<RepoFile | null> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(cfg.branch)}`;
    const res = await fetch(url, { headers: this.headers(cfg) });
    if (res.status === 404) return null;
    const data = await this.parse(res);
    if (Array.isArray(data)) return null; // is a directory
    return {
      content: Buffer.from(data.content, 'base64').toString('utf8'),
      sha: data.sha,
    };
  }

  async writeFile(
    path: string,
    content: string,
    message: string,
    sha?: string,
  ): Promise<string | undefined> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/contents/${encodePath(path)}`;
    const body: any = {
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: cfg.branch,
    };
    if (sha) body.sha = sha;
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.headers(cfg),
      body: JSON.stringify(body),
    });
    const data = await this.parse(res);
    return data?.content?.sha;
  }

  async deleteFile(path: string, message: string, sha: string): Promise<void> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/contents/${encodePath(path)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.headers(cfg),
      body: JSON.stringify({ message, sha, branch: cfg.branch }),
    });
    await this.parse(res);
  }

  async listDir(
    path: string,
  ): Promise<{ name: string; path: string; type: string; sha: string }[]> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(cfg.branch)}`;
    const res = await fetch(url, { headers: this.headers(cfg) });
    if (res.status === 404) return []; // 目录不存在
    const data = await this.parse(res);
    if (!Array.isArray(data)) return [];
    return data.map((d: any) => ({
      name: d.name,
      path: d.path,
      type: d.type,
      sha: d.sha,
    }));
  }

  async dispatchWorkflow(workflowId: string, ref: string): Promise<void> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(cfg),
      body: JSON.stringify({ ref }),
    });
    if (res.status !== 204) await this.parse(res);
  }

  async listWorkflowRuns(workflowId: string): Promise<any[]> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/actions/workflows/${encodeURIComponent(workflowId)}/runs?per_page=10`;
    const res = await fetch(url, { headers: this.headers(cfg) });
    const data = await this.parse(res);
    return data?.workflow_runs || [];
  }

  async getWorkflowRun(runId: number): Promise<any> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/actions/runs/${runId}`;
    const res = await fetch(url, { headers: this.headers(cfg) });
    return this.parse(res);
  }

  async getRepoMeta(): Promise<{
    defaultBranch: string;
    htmlUrl: string;
    name: string;
  }> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}`;
    const res = await fetch(url, { headers: this.headers(cfg) });
    const data = await this.parse(res);
    return {
      defaultBranch: data.default_branch,
      htmlUrl: data.html_url,
      name: data.name,
    };
  }
}
