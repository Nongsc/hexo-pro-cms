import { Module } from '@nestjs/common';
import { RecycleController } from './recycle.controller';
import { RecycleService } from './recycle.service';

@Module({
  controllers: [RecycleController],
  providers: [RecycleService],
})
export class RecycleModule {}
