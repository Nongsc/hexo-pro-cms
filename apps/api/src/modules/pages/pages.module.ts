import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller.js';
import { PagesService } from './pages.service.js';

@Module({
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}
