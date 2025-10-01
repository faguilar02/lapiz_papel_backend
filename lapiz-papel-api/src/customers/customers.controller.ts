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
  BadRequestException,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  SearchCustomersDto,
} from './dto';
import { PaginationDto } from '../auth/dto';
import { Auth } from '../auth/decorators';
import { UserRole } from '../auth/models/enums';
import { DocumentType } from './entities/customer.entity';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Auth()
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @Auth()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.customersService.findAll(paginationDto);
  }

  @Get('search')
  @Auth()
  search(@Query() searchDto: SearchCustomersDto) {
    console.log('🔍 Customers: search called with:', searchDto);
    return this.customersService.search(searchDto);
  }

  @Get('document/:document_type/:document_number')
  @Auth()
  findByDocument(
    @Param('document_type') document_type: string,
    @Param('document_number') document_number: string,
  ) {
    // Normalize document_type to match enum values
    const normalizedType =
      document_type.toUpperCase() === 'DNI'
        ? DocumentType.DNI
        : document_type.toUpperCase() === 'RUC'
        ? DocumentType.RUC
        : null;

    if (!normalizedType) {
      throw new BadRequestException(
        `Invalid document type: ${document_type}. Use DNI or RUC`,
      );
    }

    console.log(
      `🔍 Customers: findByDocument called with: ${normalizedType} - ${document_number}`,
    );
    return this.customersService.findByDocument(
      document_number,
      normalizedType,
    );
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @Auth()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.remove(id);
  }

  @Patch(':id/activate')
  @Auth(UserRole.ADMIN, UserRole.CASHIER)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.activate(id);
  }

  @Patch(':id/deactivate')
  @Auth(UserRole.ADMIN, UserRole.CASHIER)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.deactivate(id);
  }
}
