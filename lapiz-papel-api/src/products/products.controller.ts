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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  SearchProductsDto,
  CreateBulkPriceDto,
} from './dto';
import {
  CreateProductImageDto,
  UpdateProductImageDto,
} from './dto/product-image.dto';
import { PaginationDto } from '../auth/dto';
import { Auth } from '../auth/decorators';
import { UserRole } from '../auth/models/enums';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CASHIER)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @Auth()
  findAll(@Query() searchDto: SearchProductsDto) {
    return this.productsService.findAll(searchDto);
  }

  @Get('brands')
  @Auth()
  getAllBrands() {
    return this.productsService.getAllBrands();
  }

  @Get('search')
  @Auth()
  searchProducts(
    @Query('q') query: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    console.log('🎯 Controller: searchProducts called with q:', query);

    if (!query) {
      console.log('🎯 Controller: No query provided');
      return {
        data: [],
        total: 0,
        totalPages: 0,
        currentPage: 1,
        limit: limit || 10,
        offset: offset || 0,
      };
    }

    return this.productsService.search(query, limit, offset);
  }

  @Get('low-stock')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  getLowStock(@Query() paginationDto: PaginationDto) {
    console.log('📉 Controller: getLowStock called');
    return this.productsService.getLowStock(paginationDto);
  }

  @Get('sku/:sku')
  @Auth()
  findBySku(@Param('sku') sku: string) {
    return this.productsService.findBySku(sku);
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CASHIER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN, UserRole.CASHIER)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }

  @Patch(':id/activate')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CASHIER)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.activate(id);
  }

  @Patch(':id/deactivate')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CASHIER)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.deactivate(id);
  }

  // Image management endpoints
  @Post(':id/images')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CASHIER)
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() createImageDto: CreateProductImageDto,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size must be less than 10MB');
    }

    return await this.productsService.uploadProductImage(
      id,
      file,
      createImageDto,
    );
  }

  @Get(':id/images')
  @Auth()
  getProductImages(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getProductImages(id);
  }

  @Patch('images/:imageId')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CASHIER)
  updateProductImage(
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() updateImageDto: UpdateProductImageDto,
  ) {
    return this.productsService.updateProductImage(imageId, updateImageDto);
  }

  @Delete('images/:imageId')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CASHIER)
  deleteProductImage(@Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.productsService.deleteProductImage(imageId);
  }

  @Patch('images/:imageId/set-primary')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CASHIER)
  setPrimaryImage(@Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.productsService.setPrimaryImage(imageId);
  }

  // Bulk price endpoints
  @Post(':id/bulk-prices')
  @Auth(UserRole.ADMIN, UserRole.CASHIER)
  addBulkPrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createBulkPriceDto: CreateBulkPriceDto,
  ) {
    return this.productsService.addBulkPrice(id, createBulkPriceDto);
  }

  @Patch('bulk-prices/:id')
  @Auth(UserRole.ADMIN, UserRole.CASHIER)
  updateBulkPrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBulkPriceDto: CreateBulkPriceDto,
  ) {
    return this.productsService.updateBulkPrice(id, updateBulkPriceDto);
  }

  @Delete('bulk-prices/:id')
  @Auth(UserRole.ADMIN, UserRole.CASHIER)
  removeBulkPrice(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.removeBulkPrice(id);
  }

  @Get(':id/bulk-prices')
  @Auth()
  getBulkPrices(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getBulkPrices(id);
  }

  @Get(':id/applicable-bulk-price')
  @Auth()
  getApplicableBulkPrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('quantity') quantityStr: string,
  ) {
    const quantity = parseInt(quantityStr, 10);
    if (isNaN(quantity)) {
      throw new BadRequestException('Quantity must be a number');
    }
    return this.productsService.getApplicableBulkPrice(id, quantity);
  }
}
