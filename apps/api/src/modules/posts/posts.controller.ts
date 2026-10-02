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
import { PostsService } from './posts.service';
import { SavePostDto } from './dto/posts.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  // NOTE: static routes must be declared before :id routes.

  @Get()
  list(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.posts.list({
      status,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      keyword,
    });
  }

  @Get('check-title')
  checkTitle(
    @Query('title') title: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.posts.checkTitle(title, excludeId);
  }

  @Get('categories')
  categories() {
    return this.posts.categories();
  }

  @Get('categories/:name/posts')
  categoryPosts(
    @Param('name') name: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.posts.categoryPosts(name, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('tags')
  tags() {
    return this.posts.tags();
  }

  @Post('search')
  search(@Body() body: { q: string }) {
    return this.posts.search(body?.q);
  }

  @Post('sync')
  sync() {
    return this.posts.syncFromGithub();
  }

  @Post()
  create(@Body() dto: SavePostDto) {
    return this.posts.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.posts.get(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: SavePostDto) {
    return this.posts.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.posts.remove(id);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.posts.setStatus(id, 'published');
  }

  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.posts.setStatus(id, 'draft');
  }
}
