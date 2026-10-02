import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { PagesService } from './pages.service';
import { SavePageDto } from './dto/pages.dto';

@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.pages.list({
      status,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      keyword,
    });
  }

  @Post('sync')
  sync() {
    return this.pages.syncFromGithub();
  }

  @Post()
  create(@Body() dto: SavePageDto) {
    return this.pages.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.pages.get(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: SavePageDto) {
    return this.pages.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pages.remove(id);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.pages.setStatus(id, 'published');
  }

  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.pages.setStatus(id, 'draft');
  }
}
