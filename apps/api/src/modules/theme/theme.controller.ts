import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ThemeService } from './theme.service';
import {
  AddPluginsDto,
  InstallNpmThemeDto,
  InstallThemeDto,
  SaveThemeConfigDto,
  SwitchThemeDto,
} from './dto/theme.dto';

@Controller('theme')
export class ThemeController {
  constructor(private readonly theme: ThemeService) {}

  @Get('installed')
  installed() {
    return this.theme.installed();
  }

  @Get('current')
  current() {
    return this.theme.current();
  }

  @Get('plugins')
  plugins() {
    return this.theme.listPlugins();
  }

  @Post('plugins')
  addPlugins(@Body() dto: AddPluginsDto) {
    return this.theme.addPlugins(dto);
  }

  @Delete('plugins/:name')
  removePlugin(@Param('name') name: string) {
    return this.theme.removePlugin(name);
  }

  @Post('switch')
  switchTheme(@Body() dto: SwitchThemeDto) {
    return this.theme.switchTheme(dto.name);
  }

  @Post('install')
  install(@Body() dto: InstallThemeDto) {
    return this.theme.install(dto);
  }

  @Post('install-npm')
  installNpm(@Body() dto: InstallNpmThemeDto) {
    return this.theme.installNpm(dto);
  }

  @Get('install/status/:runId')
  installStatus(@Param('runId') runId: string) {
    return this.theme.getInstallStatus(parseInt(runId, 10));
  }

  @Delete(':name')
  uninstall(@Param('name') name: string) {
    return this.theme.uninstall(name);
  }

  @Get('config')
  getConfig(@Query('name') name: string) {
    return this.theme.getConfig(name);
  }

  @Post('config/draft')
  saveConfigDraft(@Body() dto: SaveThemeConfigDto) {
    return this.theme.saveConfigDraft(dto.name, dto.content);
  }

  @Post('config/publish')
  publishConfigDraft(@Body() dto: SwitchThemeDto) {
    return this.theme.publishConfigDraft(dto.name);
  }

  @Delete('config/draft')
  discardConfigDraft(@Query('name') name: string) {
    return this.theme.discardConfigDraft(name);
  }
}
