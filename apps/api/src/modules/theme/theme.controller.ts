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

  @Put('config')
  saveConfig(@Body() dto: SaveThemeConfigDto) {
    return this.theme.saveConfig(dto);
  }
}
