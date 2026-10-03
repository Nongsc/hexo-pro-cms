import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { RecycleService } from './recycle.service.js';

@Controller('recycle')
export class RecycleController {
  constructor(private readonly recycle: RecycleService) {}

  @Get()
  list() {
    return this.recycle.list();
  }

  @Get('stats')
  stats() {
    return this.recycle.stats();
  }

  @Post('empty')
  empty() {
    return this.recycle.empty();
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.recycle.restore(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.recycle.remove(id);
  }
}
