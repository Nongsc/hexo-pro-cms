import { Body, Controller, Get, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';
import {
  UpdateCosConfigDto,
  UpdateDeployConfigDto,
  UpdateGithubConfigDto,
  UpdateSystemConfigDto,
} from './dto/settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('system')
  getSystem() {
    return this.settings.getSystemConfig();
  }

  @Put('system')
  async updateSystem(@Body() dto: UpdateSystemConfigDto) {
    return this.settings.saveSystemConfig(dto);
  }

  @Get('github')
  async getGithub() {
    const cfg = await this.settings.getGithubConfig();
    return this.settings.maskGithub(cfg);
  }

  @Put('github')
  async updateGithub(@Body() dto: UpdateGithubConfigDto) {
    return this.settings.saveGithubConfig(dto);
  }

  @Get('cos')
  async getCos() {
    const cfg = await this.settings.getCosConfig();
    return this.settings.maskCos(cfg);
  }

  @Put('cos')
  async updateCos(@Body() dto: UpdateCosConfigDto) {
    return this.settings.saveCosConfig(dto);
  }

  @Get('deploy')
  getDeploy() {
    return this.settings.getDeployConfig();
  }

  @Put('deploy')
  async updateDeploy(@Body() dto: UpdateDeployConfigDto) {
    return this.settings.saveDeployConfig(dto);
  }

  @Get('status')
  async status() {
    const github = await this.settings.getGithubConfig();
    const cos = await this.settings.getCosConfig();
    return {
      githubConnected: !!(github.token && github.owner && github.repo),
      cosConfigured: !!(cos.secretId && cos.secretKey && cos.bucket && cos.region),
    };
  }
}
