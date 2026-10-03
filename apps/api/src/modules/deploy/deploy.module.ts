import { Module } from '@nestjs/common';
import { DeployController } from './deploy.controller.js';
import { DeployService } from './deploy.service.js';

@Module({
  controllers: [DeployController],
  providers: [DeployService],
})
export class DeployModule {}
