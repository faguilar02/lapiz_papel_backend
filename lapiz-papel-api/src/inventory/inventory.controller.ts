import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryMovementDto } from './dto';
import { PaginationDto } from '../auth/dto';
import { Auth, GetUser } from '../auth/decorators';
import { UserRole } from '../auth/models/enums';
import { User } from '../auth/entities/user.entity';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('movements')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  create(
    @Body() createInventoryMovementDto: CreateInventoryMovementDto,
    @GetUser() user: User,
  ) {
    return this.inventoryService.create(createInventoryMovementDto, user);
  }

  @Get('movements')
  @Auth()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.inventoryService.findAll(paginationDto);
  }

  @Get('movements/type/:type')
  @Auth()
  getMovementsByType(
    @Param('type') type: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.inventoryService.getMovementsByType(type, paginationDto);
  }

  @Get('movements/product/:productId')
  @Auth()
  findByProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.inventoryService.findByProduct(productId, paginationDto);
  }

  @Get('movements/:id')
  @Auth()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findOne(id);
  }
}
