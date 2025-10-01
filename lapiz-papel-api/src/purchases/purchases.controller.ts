import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import {
  CreatePurchaseDto,
  UpdatePurchaseDto,
  SearchPurchasesDto,
} from './dto';
import { PaginationDto } from '../auth/dto';
import { Auth, GetUser } from '../auth/decorators';
import { UserRole } from '../auth/models/enums';
import { User } from '../auth/entities/user.entity';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  create(@Body() createPurchaseDto: CreatePurchaseDto, @GetUser() user: User) {
    return this.purchasesService.create(createPurchaseDto, user);
  }

  @Get()
  @Auth()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.purchasesService.findAll(paginationDto);
  }

  @Get('search')
  @Auth()
  search(@Query() searchDto: SearchPurchasesDto) {
    console.log('🔍 Purchases: search called with:', searchDto);
    return this.purchasesService.search(searchDto);
  }

  @Get('reports')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  getPurchasesReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.purchasesService.getPurchasesReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasesService.findOne(id);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePurchaseDto: UpdatePurchaseDto,
  ) {
    return this.purchasesService.update(id, updatePurchaseDto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasesService.remove(id);
  }

  @Patch(':id/activate')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasesService.activate(id);
  }

  @Patch(':id/deactivate')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasesService.deactivate(id);
  }
}
