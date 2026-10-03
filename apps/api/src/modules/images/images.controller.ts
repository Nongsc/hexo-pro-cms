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
import { ImagesService } from './images.service.js';
import {
  ConfirmDto,
  DeleteBatchDto,
  MoveImageDto,
  PresignDto,
  RenameImageDto,
  SaveStorageConfigDto,
  UploadImageDto,
} from './dto/images.dto.js';

@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Get('config')
  config() {
    return this.images.config();
  }

  @Put('config')
  saveConfig(@Body() dto: SaveStorageConfigDto) {
    return this.images.saveConfig(dto);
  }

  @Get('folders')
  folders() {
    return this.images.folders();
  }

  @Get('unused')
  unused() {
    return this.images.unused();
  }

  @Post('unused/cleanup')
  cleanupUnused() {
    return this.images.cleanupUnused();
  }

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('folder') folder?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.images.list({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      folder,
      keyword,
    });
  }

  @Post('upload')
  upload(@Body() dto: UploadImageDto) {
    return this.images.upload(dto);
  }

  @Post('presign')
  presign(@Body() dto: PresignDto) {
    return this.images.presign(dto);
  }

  @Post('confirm')
  confirm(@Body() dto: ConfirmDto) {
    return this.images.confirm(dto);
  }

  @Post('delete/batch')
  deleteBatch(@Body() dto: DeleteBatchDto) {
    return this.images.removeBatch(dto.ids);
  }

  @Post('move')
  move(@Body() dto: MoveImageDto) {
    return this.images.move(dto);
  }

  @Post(':id/rename')
  rename(@Param('id') id: string, @Body() dto: RenameImageDto) {
    return this.images.rename(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.images.remove(id);
  }
}
