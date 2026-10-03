import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigsService } from './configs.service.js';
import { PathDto, RollbackDto, SaveConfigDto } from './dto/configs.dto.js';

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

  @Post('file/draft')
  saveDraft(@Body() dto: SaveConfigDto) {
    return this.configs.saveConfigDraft(dto.path, dto.content);
  }

  @Post('file/publish')
  publish(@Body() dto: PathDto) {
    return this.configs.publishConfigDraft(dto.path);
  }

  @Delete('file/draft')
  discardDraft(@Query('path') path: string) {
    return this.configs.discardConfigDraft(path);
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
