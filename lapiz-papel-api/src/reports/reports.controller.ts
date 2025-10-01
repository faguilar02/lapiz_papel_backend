import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role.guard';
import { RoleProtected } from '../auth/decorators/role-protected.decorator';
import { UserRole } from '../auth/models/enums';
import { ReportsQueryDto } from './dto/reports-query.dto';

@Controller('reports')
@UseGuards(AuthGuard(), UserRoleGuard)
@RoleProtected(UserRole.ADMIN) // Only admins can access reports
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  async getSalesReport(@Query() query: ReportsQueryDto) {
    return await this.reportsService.getSalesReport(query);
  }

  @Get('purchases')
  async getPurchasesReport(@Query() query: ReportsQueryDto) {
    return await this.reportsService.getPurchasesReport(query);
  }

  @Get('top-products')
  async getTopSellingProducts(@Query() query: ReportsQueryDto) {
    return await this.reportsService.getTopSellingProducts(query);
  }

  @Get('financial-summary')
  async getFinancialSummary(@Query() query: ReportsQueryDto) {
    return await this.reportsService.getFinancialSummary(query);
  }

  @Get('complete')
  async getCompleteReport(@Query() query: ReportsQueryDto) {
    return await this.reportsService.getCompleteReport(query);
  }
}
