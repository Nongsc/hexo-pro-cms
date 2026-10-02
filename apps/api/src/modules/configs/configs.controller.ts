import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { ConfigsService } from './configs.service';
import { RollbackDto, SaveConfigDto } from './dto/configs.dto';

@Controller('configs')
export class ConfigsController {
  constructor(private readonly configs: ConfigsService) {}

  @Get('files')
  files() {
    return this.configs.listFiles();
  }

  @Get('file')
  getFile(@Query('path') path: string) {
    return this.configs.getConfig(path);
  }

  @Put('file')
  saveFile(@Body() dto: SaveConfigDto) {
    return this.configs.saveConfig(dto.path, dto.content, dto.note);
  }

  @Get('snapshots')
  snapshots(@Query('scope') scope: string) {
    return this.configs.snapshots(scope);
  }

  @Post('rollback')
  rollback(@Body() dto: RollbackDto) {
    return this.configs.rollback(dto.id);
  }
}
