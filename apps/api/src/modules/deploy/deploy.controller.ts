import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { DeployService } from './deploy.service';
import { SaveDeployDto } from './dto/deploy.dto';

@Controller('deploy')
export class DeployController {
  constructor(private readonly deploy: DeployService) {}

  @Get('config')
  config() {
    return this.deploy.getConfig();
  }

  @Put('config')
  saveConfig(@Body() dto: SaveDeployDto) {
    return this.deploy.saveConfig(dto);
  }

  @Post('execute')
  execute() {
    return this.deploy.execute();
  }

  @Get('status')
  status() {
    return this.deploy.status();
  }

  @Post('reset-status')
  resetStatus() {
    return this.deploy.resetStatus();
  }
}
