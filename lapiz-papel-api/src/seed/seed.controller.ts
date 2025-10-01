import {
  Controller,
  Get,
  Delete,
  Post,
  Put,
  UseGuards,
  Body,
} from '@nestjs/common';
import { SeedService } from './seed.service';
import { AuthGuard } from '@nestjs/passport';
import { RoleProtected } from '../auth/decorators/role-protected.decorator';
import { UserRoleGuard } from '../auth/guards/user-role.guard';
import { UserRole } from '../auth/models/enums';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  async runSeed() {
    return this.seedService.runSeed();
  }

  @Post('company-settings')
  @UseGuards(AuthGuard(), UserRoleGuard)
  @RoleProtected(UserRole.ADMIN)
  async insertCompanySettings() {
    return this.seedService.insertCompanySettings();
  }

  @Delete('clear-all')
  @UseGuards(AuthGuard(), UserRoleGuard)
  @RoleProtected(UserRole.ADMIN)
  async clearAllData() {
    return this.seedService.clearAllData();
  }

  @Put('update-logo')
  @UseGuards(AuthGuard(), UserRoleGuard)
  @RoleProtected(UserRole.ADMIN)
  async updateCompanyLogo(@Body() body: { logo_base64: string }) {
    return this.seedService.updateCompanyLogo(body.logo_base64);
  }
}
