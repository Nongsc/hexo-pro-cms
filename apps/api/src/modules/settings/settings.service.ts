import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CosConfig,
  DeployConfig,
  GithubConfig,
  SystemConfig,
} from '../../config/types';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return (row?.value as T) ?? fallback;
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as any },
      update: { value: value as any },
    });
  }

  // ---- typed configs -------------------------------------------------

  async getGithubConfig(): Promise<GithubConfig> {
    const fallback: GithubConfig = {
      token: this.config.get('github.token') || '',
      owner: this.config.get('github.owner') || '',
      repo: this.config.get('github.repo') || '',
      branch: this.config.get('github.branch') || 'master',
    };
    const db = await this.getSetting<Partial<GithubConfig>>('github', {});
    return { ...fallback, ...db };
  }

  async saveGithubConfig(patch: Partial<GithubConfig>) {
    const current = await this.getGithubConfig();
    const next = { ...current, ...patch };
    await this.setSetting('github', next);
    return this.maskGithub(next);
  }

  async getCosConfig(): Promise<CosConfig> {
    const fallback: CosConfig = {
      secretId: this.config.get('cos.secretId') || '',
      secretKey: this.config.get('cos.secretKey') || '',
      bucket: this.config.get('cos.bucket') || '',
      region: this.config.get('cos.region') || '',
      customDomain: this.config.get('cos.customDomain') || '',
      basePath: 'images',
    };
    const db = await this.getSetting<Partial<CosConfig>>('cos', {});
    return { ...fallback, ...db };
  }

  async saveCosConfig(patch: Partial<CosConfig>) {
    const current = await this.getCosConfig();
    const next = { ...current, ...patch };
    await this.setSetting('cos', next);
    return this.maskCos(next);
  }

  async getDeployConfig(): Promise<DeployConfig> {
    const fallback: DeployConfig = {
      workflowId: '',
      ref: '',
      autoTrigger: false,
    };
    const db = await this.getSetting<Partial<DeployConfig>>('deploy', {});
    return { ...fallback, ...db };
  }

  async saveDeployConfig(patch: Partial<DeployConfig>) {
    const current = await this.getDeployConfig();
    const next = { ...current, ...patch };
    await this.setSetting('deploy', next);
    return next;
  }

  async getSystemConfig(): Promise<SystemConfig> {
    const fallback: SystemConfig = {
      siteName: '',
      siteUrl: '',
      language: 'zh-CN',
      timezone: 'Asia/Shanghai',
    };
    const db = await this.getSetting<Partial<SystemConfig>>('system', {});
    return { ...fallback, ...db };
  }

  async saveSystemConfig(patch: Partial<SystemConfig>) {
    const current = await this.getSystemConfig();
    const next = { ...current, ...patch };
    await this.setSetting('system', next);
    return next;
  }

  // ---- masking helpers ----------------------------------------------

  maskGithub(cfg: GithubConfig) {
    return { ...cfg, token: this.maskSecret(cfg.token) };
  }

  maskCos(cfg: CosConfig) {
    return { ...cfg, secretKey: this.maskSecret(cfg.secretKey) };
  }

  private maskSecret(v: string | undefined): string {
    if (!v) return '';
    return v.length <= 4 ? '****' : `****${v.slice(-4)}`;
  }
}
