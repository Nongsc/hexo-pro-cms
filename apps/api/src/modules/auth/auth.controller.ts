import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('check-first-use')
  checkFirstUse() {
    return this.auth.checkFirstUse();
  }

  @Public()
  @Get('status')
  status() {
    return this.auth.checkFirstUse();
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('skip-setup')
  skipSetup() {
    return this.auth.skipSetup();
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Get('security-question')
  securityQuestion(@Query('username') username: string) {
    return this.auth.getSecurityQuestion(username);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Post('refresh-token')
  refreshToken(@Body() body: { refreshToken: string }) {
    return this.auth.refreshToken(body?.refreshToken);
  }

  @Post('refresh')
  refresh(@CurrentUser() user: JwtUser) {
    return this.auth.refresh(user);
  }

  @Get('me')
  me(@CurrentUser('sub') sub: string) {
    return this.auth.me(sub);
  }
}
