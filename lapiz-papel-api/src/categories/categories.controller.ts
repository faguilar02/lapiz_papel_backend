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
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  SearchCategoriesDto,
} from './dto';
import { PaginationDto } from '../auth/dto';
import { Auth } from '../auth/decorators';
import { UserRole } from '../auth/models/enums';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CASHIER)
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @Auth()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.categoriesService.findAll(paginationDto);
  }

  @Get('search')
  @Auth()
  search(@Query() searchDto: SearchCategoriesDto) {
    console.log('🔍 Categories: search called with:', searchDto);
    return this.categoriesService.search(searchDto);
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CASHIER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN, UserRole.CASHIER)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }

  @Patch(':id/activate')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CASHIER)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.activate(id);
  }

  @Patch(':id/deactivate')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CASHIER)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.deactivate(id);
  }
}
