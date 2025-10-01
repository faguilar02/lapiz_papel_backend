import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role.guard';
import { RoleProtected } from '../auth/decorators/role-protected.decorator';
import { UserRole } from '../auth/models/enums';

@Controller('dashboard')
@UseGuards(AuthGuard(), UserRoleGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RoleProtected(UserRole.ADMIN, UserRole.CASHIER, UserRole.WAREHOUSE)
  async getDashboardStats() {
    return await this.dashboardService.getDashboardStats();
  }

  @Get('low-stock')
  @RoleProtected(UserRole.ADMIN, UserRole.WAREHOUSE)
  async getLowStockProducts(@Query('limit') limit: string = '20') {
    return await this.dashboardService.getLowStockProducts(parseInt(limit));
  }

  @Get('today-sales')
  @RoleProtected(UserRole.ADMIN, UserRole.CASHIER)
  async getTodaySalesDetails() {
    return await this.dashboardService.getTodaySalesDetails();
  }
}
