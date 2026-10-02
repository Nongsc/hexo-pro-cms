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

  async dispatchWorkflow(
    workflowId: string,
    ref: string,
    inputs?: Record<string, string>,
  ): Promise<void> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`;
    const body: any = { ref };
    if (inputs) body.inputs = inputs;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(cfg),
      body: JSON.stringify(body),
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

  // ---- git data API（用于主题安装等整树提交） ---------------------

  async getBranchHeadSha(branch: string): Promise<string> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${encodeURIComponent(branch)}`;
    const res = await fetch(url, { headers: this.headers(cfg) });
    const data = await this.parse(res);
    return data.object.sha;
  }

  async getCommitTreeSha(commitSha: string): Promise<string> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/git/commits/${commitSha}`;
    const res = await fetch(url, { headers: this.headers(cfg) });
    const data = await this.parse(res);
    return data.tree.sha;
  }

  async getTree(
    treeSha: string,
  ): Promise<{ path: string; mode: string; type: string; sha: string }[]> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/git/trees/${treeSha}`;
    const res = await fetch(url, { headers: this.headers(cfg) });
    const data = await this.parse(res);
    return (data.tree || []).map((e: any) => ({
      path: e.path,
      mode: e.mode,
      type: e.type,
      sha: e.sha,
    }));
  }

  async createBlob(content: Buffer): Promise<string> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/git/blobs`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(cfg),
      body: JSON.stringify({
        content: content.toString('base64'),
        encoding: 'base64',
      }),
    });
    const data = await this.parse(res);
    return data.sha;
  }

  async createTree(
    baseTreeSha: string | undefined,
    entries: { path: string; mode: string; type: string; sha: string }[],
  ): Promise<string> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/git/trees`;
    const body: any = { tree: entries };
    if (baseTreeSha) body.base_tree = baseTreeSha;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(cfg),
      body: JSON.stringify(body),
    });
    const data = await this.parse(res);
    return data.sha;
  }

  async createCommit(
    message: string,
    treeSha: string,
    parentSha: string,
  ): Promise<string> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/git/commits`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(cfg),
      body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
    });
    const data = await this.parse(res);
    return data.sha;
  }

  async updateBranchRef(branch: string, sha: string): Promise<void> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${encodeURIComponent(branch)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: this.headers(cfg),
      body: JSON.stringify({ sha, force: false }),
    });
    await this.parse(res);
  }

  async downloadTarball(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new BadRequestException(`下载失败 (HTTP ${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  // ---- 远程仓库（主题源）的只读访问，使用同一 token -----------------

  async getRemoteDefaultBranch(owner: string, repo: string): Promise<string> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${owner}/${repo}`;
    const res = await fetch(url, { headers: this.headers(cfg) });
    const data = await this.parse(res);
    return data.default_branch;
  }

  async getRemoteTreeRecursive(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<{ path: string; type: string; sha: string }[]> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
    const res = await fetch(url, { headers: this.headers(cfg) });
    const data = await this.parse(res);
    return (data.tree || []).map((e: any) => ({
      path: e.path,
      type: e.type,
      sha: e.sha,
    }));
  }

  async getRemoteBlobContent(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<Buffer> {
    const cfg = await this.auth();
    const url = `${this.apiBase}/repos/${owner}/${repo}/git/blobs/${sha}`;
    const res = await fetch(url, { headers: this.headers(cfg) });
    const data = await this.parse(res);
    return Buffer.from(data.content, 'base64');
  }
}
