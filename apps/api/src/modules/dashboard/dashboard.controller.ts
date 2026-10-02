import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AddTodoDto } from './dto/dashboard.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  stats() {
    return this.dashboard.postsStats();
  }

  @Get('categories')
  categories() {
    return this.dashboard.categoriesList();
  }

  @Get('tags')
  tags() {
    return this.dashboard.tagsList();
  }

  @Get('recent')
  recent(@Query('limit') limit?: string) {
    return this.dashboard.recentPosts(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('system')
  system() {
    return this.dashboard.systemInfo();
  }

  @Get('monthly')
  monthly() {
    return this.dashboard.monthlyStats();
  }

  @Get('visits')
  visits() {
    return this.dashboard.visitStats();
  }

  @Get('todos')
  todos() {
    return this.dashboard.todosList();
  }

  @Post('todos')
  addTodo(@Body() dto: AddTodoDto) {
    return this.dashboard.todoAdd(dto);
  }

  @Post('todos/:id/toggle')
  toggleTodo(@Param('id') id: string) {
    return this.dashboard.todoToggle(id);
  }

  @Delete('todos/:id')
  deleteTodo(@Param('id') id: string) {
    return this.dashboard.todoDelete(id);
  }
}
