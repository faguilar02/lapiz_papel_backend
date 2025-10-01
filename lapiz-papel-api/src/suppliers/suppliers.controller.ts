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
import { SuppliersService } from './suppliers.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  SearchSuppliersDto,
} from './dto';
import { PaginationDto } from '../auth/dto';
import { Auth } from '../auth/decorators';
import { UserRole } from '../auth/models/enums';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  @Get()
  @Auth()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.suppliersService.findAll(paginationDto);
  }

  @Get('search')
  @Auth()
  search(@Query() searchDto: SearchSuppliersDto) {
    console.log('🔍 Suppliers: search called with:', searchDto);
    return this.suppliersService.search(searchDto);
  }

  @Get('ruc/:ruc')
  @Auth()
  findByRuc(@Param('ruc') ruc: string) {
    console.log('🔍 Suppliers: findByRuc called with:', ruc);
    return this.suppliersService.findByRuc(ruc);
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.remove(id);
  }

  @Patch(':id/activate')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.activate(id);
  }

  @Patch(':id/deactivate')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.deactivate(id);
  }
}
