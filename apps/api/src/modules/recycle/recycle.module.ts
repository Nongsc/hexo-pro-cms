import { Module } from '@nestjs/common';
import { RecycleController } from './recycle.controller.js';
import { RecycleService } from './recycle.service.js';

@Module({
  controllers: [RecycleController],
  providers: [RecycleService],
})
export class RecycleModule {}
