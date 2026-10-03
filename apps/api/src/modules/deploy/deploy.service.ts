import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GithubService } from '../../github/github.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { SaveDeployDto } from './dto/deploy.dto.js';

@Injectable()
export class DeployService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
    private readonly settings: SettingsService,
  ) {}

  getConfig() {
    return this.settings.getDeployConfig();
  }

  saveConfig(dto: SaveDeployDto) {
    return this.settings.saveDeployConfig(dto);
  }

  private async getStatusRecord() {
    let record = await this.prisma.deployStatus.findFirst({
      where: { key: 'default' },
    });
    if (!record) {
      record = await this.prisma.deployStatus.create({
        data: { key: 'default' },
      });
    }
    return record;
  }

  async execute() {
    const cfg = await this.settings.getDeployConfig();
    if (!cfg.workflowId) {
      throw new BadRequestException('请先在部署设置中配置 GitHub Actions 工作流');
    }
    const githubCfg = await this.settings.getGithubConfig();
    const ref = cfg.ref || githubCfg.branch || 'master';

    const record = await this.getStatusRecord();
    await this.prisma.deployStatus.update({
      where: { id: record.id },
      data: {
        isDeploying: true,
        progress: 10,
        stage: 'triggering',
        error: null,
        lastDeployTime: new Date(),
      },
    });

    try {
      await this.github.dispatchWorkflow(cfg.workflowId, ref);
      const runs = await this.github.listWorkflowRuns(cfg.workflowId);
      const latest = runs[0];
      await this.prisma.deployStatus.update({
        where: { id: record.id },
        data: {
          isDeploying: true,
          progress: 30,
          stage: 'running',
          runId: latest?.id ? String(latest.id) : null,
          runUrl: latest?.html_url || null,
        },
      });
      return { ok: true, runId: latest?.id, runUrl: latest?.html_url };
    } catch (e: any) {
      await this.prisma.deployStatus.update({
        where: { id: record.id },
        data: {
          isDeploying: false,
          stage: 'failed',
          error: e?.message || '触发部署失败',
        },
      });
      throw e;
    }
  }

  async status() {
    const record = await this.getStatusRecord();
    let run: any = null;
    if (record.runId) {
      try {
        run = await this.github.getWorkflowRun(Number(record.runId));
      } catch {
        run = null;
      }
    }
    const liveStatus = run?.status || 'idle';
    const isDeploying =
      run != null
        ? liveStatus === 'queued' || liveStatus === 'in_progress'
        : record.isDeploying;
    const conclusion = run?.conclusion || null;

    return {
      isDeploying,
      progress: isDeploying ? 60 : conclusion === 'success' ? 100 : 0,
      stage: isDeploying
        ? 'running'
        : conclusion === 'success'
          ? 'success'
          : conclusion === 'failure'
            ? 'failed'
            : 'idle',
      lastDeployTime: run?.updated_at || record.lastDeployTime,
      runId: record.runId,
      runUrl: record.runUrl,
      run: run
        ? {
            id: run.id,
            status: run.status,
            conclusion: run.conclusion,
            html_url: run.html_url,
            created_at: run.created_at,
            updated_at: run.updated_at,
          }
        : null,
      error: record.error,
    };
  }

  async resetStatus() {
    const record = await this.getStatusRecord();
    return this.prisma.deployStatus.update({
      where: { id: record.id },
      data: {
        isDeploying: false,
        progress: 0,
        stage: 'idle',
        error: null,
        runId: null,
        runUrl: null,
      },
    });
  }
}
