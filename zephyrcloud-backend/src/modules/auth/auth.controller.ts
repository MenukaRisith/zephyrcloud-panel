import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @Post('register')
  public register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  public login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
