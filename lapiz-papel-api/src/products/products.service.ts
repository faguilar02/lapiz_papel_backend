import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductBulkPrice } from './entities/product-bulk-price.entity';
import { Category } from '../categories/entities/category.entity';
import { CreateProductDto, UpdateProductDto, SearchProductsDto } from './dto';
import {
  CreateProductImageDto,
  UpdateProductImageDto,
} from './dto/product-image.dto';
import { CreateBulkPriceDto } from './dto/create-bulk-price.dto';
import { PaginationDto } from '../auth/dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PaginatedResponse } from '../auth/interfaces/paginated-response.interface';
import { createPaginatedResponse } from '../auth/utils/pagination.helper';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
    @InjectRepository(ProductBulkPrice)
    private readonly bulkPriceRepository: Repository<ProductBulkPrice>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    try {
      // Generar SKU automáticamente si no viene en el DTO
      if (!createProductDto.sku) {
        createProductDto.sku = await this.generateSKU(
          createProductDto.name,
          createProductDto.category_id,
        );
      }

      const product = this.productRepository.create(createProductDto);
      return await this.productRepository.save(product);
    } catch (error) {
      if (error.code === '23505') {
        // Unique constraint violation
        throw new ConflictException('Product SKU already exists');
      }
      throw error;
    }
  }

  async findAll(
    searchDto: SearchProductsDto,
  ): Promise<PaginatedResponse<Product>> {
    const {
      search,
      category_id,
      brand,
      low_stock,
      limit = 10,
      offset = 0,
    } = searchDto;

    console.log('🔍 Products Service: findAll called with:', searchDto);
    console.log('🔍 low_stock value:', low_stock, 'type:', typeof low_stock);

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .addSelect('product.is_active')
      .orderBy('product.created_at', 'DESC');

    // Filtro por búsqueda general (por palabras clave) - insensible a tildes/acentos
    if (search) {
      // Dividir la búsqueda en palabras individuales
      const keywords = search.trim().split(/\s+/); // Separa por espacios

      // Crear una condición AND para cada palabra con búsqueda insensible a acentos
      keywords.forEach((keyword, index) => {
        // Normalizar el término de búsqueda removiendo acentos
        const normalizedKeyword = this.removeAccents(keyword);

        queryBuilder.andWhere(
          `(
            unaccent(product.name) ILIKE unaccent(:keyword${index}) OR 
            unaccent(product.sku) ILIKE unaccent(:keyword${index}) OR 
            unaccent(product.brand) ILIKE unaccent(:keyword${index}) OR 
            unaccent(category.name) ILIKE unaccent(:keyword${index})
          )`,
          { [`keyword${index}`]: `%${normalizedKeyword}%` },
        );
      });
    }

    // Filtro por categoría
    if (category_id) {
      queryBuilder.andWhere('product.category_id = :category_id', {
        category_id,
      });
    }

    // Filtro por marca
    if (brand) {
      queryBuilder.andWhere('product.brand = :brand', { brand });
    }

    // Filtro por stock bajo (cuando stock_quantity <= minimum_stock)
    if (low_stock) {
      // Convertir a numérico para comparación correcta (NUMERIC se guarda como string)
      queryBuilder.andWhere(
        'CAST(product.stock_quantity AS DECIMAL) <= CAST(product.minimum_stock AS DECIMAL)',
      );
      console.log('📉 Aplicando filtro de bajo stock');
    }

    // NOTA: Ahora incluimos TODOS los productos, tanto activos como inactivos

    const [data, total] = await queryBuilder
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    console.log('🔍 Products Service: found', total, 'products');
    return createPaginatedResponse(data, total, limit, offset);
  }

  /**
   * Obtiene todas las marcas únicas de productos (sin repetir)
   */
  async getAllBrands(): Promise<{ brands: string[] }> {
    const result = await this.productRepository
      .createQueryBuilder('product')
      .select('DISTINCT product.brand', 'brand')
      .where('product.brand IS NOT NULL')
      .andWhere("product.brand != ''")
      .orderBy('product.brand', 'ASC')
      .getRawMany();

    const brands = result.map((row) => row.brand);

    console.log(`🏷️ Found ${brands.length} unique brands`);
    return { brands };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'images', 'bulk_prices'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findBySku(sku: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { sku },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);

    try {
      Object.assign(product, updateProductDto);
      return await this.productRepository.save(product);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Product SKU already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    product.is_active = false;
    await this.productRepository.save(product);
  }

  async activate(id: string): Promise<Product> {
    const product = await this.findOne(id);
    product.is_active = true;
    return await this.productRepository.save(product);
  }

  async deactivate(id: string): Promise<Product> {
    const product = await this.findOne(id);
    product.is_active = false;
    return await this.productRepository.save(product);
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const product = await this.findOne(id);

    // Convertir stock_quantity a número para evitar concatenación
    const currentStock = Number(product.stock_quantity);
    const newStock = currentStock + quantity;

    if (newStock < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    product.stock_quantity = newStock;
    return await this.productRepository.save(product);
  }

  async search(
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<PaginatedResponse<Product>> {
    console.log('🔍 Service: search called with query:', query);

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.is_active = :isActive', { isActive: true });

    // Búsqueda por palabras clave
    if (query && query.trim()) {
      const keywords = query.trim().split(/\s+/);

      keywords.forEach((keyword, index) => {
        queryBuilder.andWhere(
          `(product.name ILIKE :keyword${index} OR product.sku ILIKE :keyword${index} OR product.brand ILIKE :keyword${index} OR category.name ILIKE :keyword${index})`,
          { [`keyword${index}`]: `%${keyword}%` },
        );
      });
    }

    queryBuilder.orderBy('product.created_at', 'DESC');

    const [data, total] = await queryBuilder
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    console.log('🔍 Service: search found', total, 'products');
    return createPaginatedResponse(data, total, limit, offset);
  }

  async getLowStock(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<Product>> {
    const { limit = 20, offset = 0 } = paginationDto;

    console.log('📉 Products Service: getLowStock called with:', paginationDto);

    const [data, total] = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.stock_quantity <= product.minimum_stock')
      .andWhere('product.is_active = :isActive', { isActive: true })
      .orderBy('product.stock_quantity', 'ASC') // Los más críticos primero
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    console.log('📉 Products Service: found', total, 'low stock products');
    return createPaginatedResponse(data, total, limit, offset);
  }

  // Image management methods
  async uploadProductImage(
    productId: string,
    file: Express.Multer.File,
    createImageDto: CreateProductImageDto,
  ): Promise<ProductImage> {
    // Verify product exists
    await this.findOne(productId);

    // Upload to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadImage(file);

    // If this is set as primary, unset other primary images
    if (createImageDto.is_primary) {
      await this.productImageRepository.update(
        { product_id: productId, is_primary: true },
        { is_primary: false },
      );
    }

    // Create image record
    const productImage = this.productImageRepository.create({
      product_id: productId,
      image_url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      alt_text: createImageDto.alt_text,
      is_primary: createImageDto.is_primary || false,
      sort_order: createImageDto.sort_order || 0,
    });

    const savedImage = await this.productImageRepository.save(productImage);

    // If this is primary image, also update the main product image_url
    if (createImageDto.is_primary) {
      await this.productRepository.update(productId, {
        image_url: uploadResult.secure_url,
      });
    }

    return savedImage;
  }

  async getProductImages(productId: string): Promise<ProductImage[]> {
    await this.findOne(productId); // Verify product exists

    return await this.productImageRepository.find({
      where: { product_id: productId },
      order: { sort_order: 'ASC', created_at: 'ASC' },
    });
  }

  async updateProductImage(
    imageId: string,
    updateImageDto: UpdateProductImageDto,
  ): Promise<ProductImage> {
    const image = await this.productImageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    // If setting as primary, unset other primary images for this product
    if (updateImageDto.is_primary) {
      await this.productImageRepository.update(
        { product_id: image.product_id, is_primary: true },
        { is_primary: false },
      );
    }

    Object.assign(image, updateImageDto);
    return await this.productImageRepository.save(image);
  }

  async deleteProductImage(imageId: string): Promise<void> {
    const image = await this.productImageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    // Delete from Cloudinary
    try {
      await this.cloudinaryService.deleteImage(image.public_id);
    } catch (error) {
      console.error('Error deleting from Cloudinary:', error);
      // Continue with database deletion even if Cloudinary fails
    }

    // Delete from database
    await this.productImageRepository.remove(image);
  }

  async setPrimaryImage(imageId: string): Promise<ProductImage> {
    const image = await this.productImageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    // Unset other primary images for this product
    await this.productImageRepository.update(
      { product_id: image.product_id, is_primary: true },
      { is_primary: false },
    );

    // Set this image as primary
    image.is_primary = true;
    return await this.productImageRepository.save(image);
  }

  // Bulk price methods
  async addBulkPrice(
    productId: string,
    createBulkPriceDto: CreateBulkPriceDto,
  ): Promise<ProductBulkPrice> {
    const product = await this.findOne(productId);

    // Verificar que no exista un precio para la misma cantidad
    const existingBulkPrice = await this.bulkPriceRepository.findOne({
      where: {
        product_id: productId,
        min_quantity: createBulkPriceDto.min_quantity,
        is_active: true,
      },
    });

    if (existingBulkPrice) {
      throw new ConflictException(
        `A bulk price already exists for quantity: ${createBulkPriceDto.min_quantity}`,
      );
    }

    const bulkPrice = this.bulkPriceRepository.create({
      ...createBulkPriceDto,
      product_id: productId,
    });

    return await this.bulkPriceRepository.save(bulkPrice);
  }

  async updateBulkPrice(
    id: string,
    updateBulkPriceDto: CreateBulkPriceDto,
  ): Promise<ProductBulkPrice> {
    const bulkPrice = await this.bulkPriceRepository.findOne({
      where: { id },
    });

    if (!bulkPrice) {
      throw new NotFoundException('Bulk price not found');
    }

    // Verificar que no exista otro precio para la misma cantidad (excepto el actual)
    const existingBulkPrice = await this.bulkPriceRepository.findOne({
      where: {
        product_id: bulkPrice.product_id,
        min_quantity: updateBulkPriceDto.min_quantity,
        id: Not(id),
        is_active: true,
      },
    });

    if (existingBulkPrice) {
      throw new ConflictException(
        'A bulk price for this quantity already exists',
      );
    }

    Object.assign(bulkPrice, updateBulkPriceDto);
    return await this.bulkPriceRepository.save(bulkPrice);
  }

  async removeBulkPrice(id: string): Promise<void> {
    const bulkPrice = await this.bulkPriceRepository.findOne({
      where: { id },
    });

    if (!bulkPrice) {
      throw new NotFoundException('Bulk price not found');
    }

    // Soft delete
    bulkPrice.is_active = false;
    await this.bulkPriceRepository.save(bulkPrice);
  }

  async getBulkPrices(productId: string): Promise<ProductBulkPrice[]> {
    await this.findOne(productId); // Verify product exists

    return await this.bulkPriceRepository.find({
      where: {
        product_id: productId,
        is_active: true,
      },
      order: { min_quantity: 'ASC' },
    });
  }

  async getApplicableBulkPrice(
    productId: string,
    quantity: number,
  ): Promise<any> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    const product = await this.findOne(productId);
    if (!product.is_active) {
      throw new BadRequestException('Product is not active');
    }

    // Formatear precios base
    const base_prices = {
      sale_unit_price: Number(product.sale_price).toFixed(2),
    };

    // Buscar el mejor tier aplicable (cantidad >= min_quantity)
    // Ordenado de mayor a menor para obtener el mejor descuento
    const applicableTier = await this.bulkPriceRepository
      .createQueryBuilder('bulk_price')
      .where('bulk_price.product_id = :productId', { productId })
      .andWhere('bulk_price.min_quantity <= :quantity', { quantity })
      .andWhere('bulk_price.is_active = :isActive', { isActive: true })
      .orderBy('bulk_price.min_quantity', 'DESC')
      .getOne();

    // Si hay tier aplicable
    if (applicableTier) {
      // ✅ NUEVO: Calcular el total correcto según el tipo de bulk price
      let sale_total: string;
      let sale_unit_price_effective: number;

      if (quantity === applicableTier.min_quantity) {
        // Si la cantidad coincide exactamente con la mínima, usar el precio bundle directo
        sale_total = Number(applicableTier.sale_bundle_total).toFixed(2);
        sale_unit_price_effective =
          Number(applicableTier.sale_bundle_total) / quantity;
      } else {
        // Si la cantidad es mayor, calcular proporcionalmente
        const pricePerUnit =
          Number(applicableTier.sale_bundle_total) /
          applicableTier.min_quantity;
        sale_total = (pricePerUnit * quantity).toFixed(2);
        sale_unit_price_effective = pricePerUnit;
      }

      return {
        product_id: productId,
        quantity_requested: quantity,
        base_prices,
        bulk_price_applied: true,
        tier_applied: {
          id: applicableTier.id,
          min_quantity: applicableTier.min_quantity,
          pricing_mode: applicableTier.pricing_mode,
          sale_bundle_total: applicableTier.sale_bundle_total,
        },
        effective_prices: {
          sale_unit_price_effective: sale_unit_price_effective,
        },
        totals: {
          sale_total,
        },
        savings: {
          sale_savings: (
            Number(product.sale_price) * quantity -
            Number(sale_total)
          ).toFixed(2),
          sale_savings_percentage: (
            ((Number(product.sale_price) * quantity - Number(sale_total)) /
              (Number(product.sale_price) * quantity)) *
            100
          ).toFixed(2),
        },
        price_source: 'bulk_price',
        message: `Bulk price applied for ${applicableTier.min_quantity}+ units`,
      };
    }

    // Si no hay tier aplicable, usar precios base
    const sale_total = (Number(product.sale_price) * quantity).toFixed(2);

    return {
      product_id: productId,
      quantity_requested: quantity,
      base_prices,
      bulk_price_applied: false,
      tier_applied: null,
      effective_prices: {
        sale_unit_price_effective: base_prices.sale_unit_price,
      },
      totals: {
        sale_total,
      },
      savings: {
        sale_savings: '0.00',
        sale_savings_percentage: '0.00',
      },
      price_source: 'base',
      message: 'No bulk price available for this quantity',
    };
  }

  // Helper method para calcular el precio de venta total considerando precios por volumen
  async calculateTotalSalePrice(
    productId: string,
    quantity: number,
  ): Promise<{
    totalPrice: number;
    appliedBulkPrice?: ProductBulkPrice;
    message?: string;
  }> {
    const product = await this.findOne(productId);
    const { bulkPrice, message } = await this.getApplicableBulkPrice(
      productId,
      quantity,
    );

    if (bulkPrice) {
      return {
        totalPrice: bulkPrice.sale_price * quantity,
        appliedBulkPrice: bulkPrice,
        message,
      };
    }

    return {
      totalPrice: product.sale_price * quantity,
    };
  }

  // Helper method para calcular el precio de compra total considerando precios por volumen
  async calculateTotalCostPrice(
    productId: string,
    quantity: number,
  ): Promise<{
    totalPrice: number;
    appliedBulkPrice?: ProductBulkPrice;
    message?: string;
  }> {
    const product = await this.findOne(productId);
    const { bulkPrice, message } = await this.getApplicableBulkPrice(
      productId,
      quantity,
    );

    if (bulkPrice) {
      return {
        totalPrice: bulkPrice.cost_price * quantity,
        appliedBulkPrice: bulkPrice,
        message,
      };
    }

    return {
      totalPrice: product.cost_price * quantity,
    };
  }

  /**
   * Importa productos masivamente desde un archivo Excel
   * Procesa TODAS las pestañas del archivo
   */
  async importProductsFromExcel(buffer: Buffer): Promise<{
    success: boolean;
    total_rows: number;
    imported: number;
    failed: number;
    sheets_processed: number;
    errors: Array<{
      row: number;
      sheet: string;
      product_name: string;
      error: string;
    }>;
    created_products: Array<{
      row: number;
      sheet: string;
      product_name: string;
      product_id: string;
      bulk_prices_created: number;
    }>;
  }> {
    const XLSX = require('xlsx');

    // Leer el archivo Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    console.log(
      `📚 Excel tiene ${
        workbook.SheetNames.length
      } pestaña(s): ${workbook.SheetNames.join(', ')}`,
    );

    const errors: Array<{
      row: number;
      sheet: string;
      product_name: string;
      error: string;
    }> = [];
    const created_products: Array<{
      row: number;
      sheet: string;
      product_name: string;
      product_id: string;
      action: 'created' | 'updated';
      bulk_prices_created: number;
      bulk_prices_updated: number;
    }> = [];

    let totalRows = 0;
    let imported = 0;
    let failed = 0;

    // Procesar cada pestaña del Excel
    for (const sheetName of workbook.SheetNames) {
      console.log(`\n📄 Procesando pestaña: "${sheetName}"`);

      const worksheet = workbook.Sheets[sheetName];

      // Convertir a JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: null });

      if (rawData.length === 0) {
        console.log(`⚠️  Pestaña "${sheetName}" está vacía, se omite`);
        continue;
      }

      console.log(`   📊 ${rawData.length} filas encontradas`);
      totalRows += rawData.length;

      // Mapear nombres de columnas en español a nombres técnicos
      const normalizeColumnName = (name: string): string => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remover acentos
          .trim();
      };

      const columnMapping = {
        'nombre del producto': 'nombre', // "Nombre del producto"
        'nombre de producto': 'nombre',
        nombre: 'nombre',
        marca: 'marca',
        categoria: 'categoria',
        unidad: 'unidad',
        'precio de venta': 'precio_venta',
        precio_venta: 'precio_venta',
        'precio de compra': 'precio_compra',
        precio_compra: 'precio_compra',
        'cantidad de stock': 'cantidad_stock',
        cantidad_stock: 'cantidad_stock',
        'stock minimo': 'stock_minimo',
        stock_minimo: 'stock_minimo',
        'mayoreo a partir de 3': 'mayoreo_3',
        mayoreo_3: 'mayoreo_3',
        'mayoreo a partir de 6': 'mayoreo_6',
        mayoreo_6: 'mayoreo_6',
        'mayoreo a partir de 25': 'mayoreo_25',
        mayoreo_25: 'mayoreo_25',
        'mayoreo a partir de 50': 'mayoreo_50',
        mayoreo_50: 'mayoreo_50',
        sku: 'sku',
      };

      // Log para debugging - ver qué columnas detecta el Excel
      if (rawData.length > 0) {
        const firstRow = rawData[0];
        console.log(`   � Columnas detectadas:`);
        Object.keys(firstRow).forEach((key) => {
          const normalized = normalizeColumnName(key);
          const mapped = columnMapping[normalized];
          console.log(`      - "${key}" → "${mapped || 'NO MAPEADO'}"`);
        });
      }

      // Normalizar los datos + detectar columnas de mayoreo dinámicas
      const data = rawData.map((row) => {
        const normalizedRow = {};
        const dynamicMayoreo = {}; // Para almacenar mayoreos dinámicos

        Object.keys(row).forEach((key) => {
          const normalizedKey = normalizeColumnName(key);
          const mappedKey = columnMapping[normalizedKey];

          if (mappedKey) {
            normalizedRow[mappedKey] = row[key];
          } else {
            // Detectar columnas de mayoreo dinámicas: "mayoreo a partir de X" o "mayoreo X" o "mayoreo_X"
            const mayoreoMatch = normalizedKey.match(
              /mayoreo\s*(?:a\s*partir\s*de\s*)?(\d+)/,
            );
            if (mayoreoMatch) {
              const quantity = parseInt(mayoreoMatch[1], 10);
              if (quantity > 0) {
                dynamicMayoreo[`mayoreo_${quantity}`] = row[key];
                console.log(
                  `   🔍 Detectada columna dinámica de mayoreo: "${key}" → cantidad ${quantity}`,
                );
              }
            }
          }
        });

        // Combinar datos normalizados con mayoreos dinámicos
        return { ...normalizedRow, ...dynamicMayoreo };
      });

      // Procesar cada fila de esta pestaña
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2; // +2 porque Excel empieza en 1 y hay header

        try {
          // Validar campos requeridos
          if (!row.nombre || !row.precio_venta) {
            throw new Error(
              'Campos requeridos faltantes: nombre y precio_venta son obligatorios',
            );
          }

          // Buscar o crear categoría si viene
          let categoryId = null;
          if (row.categoria && row.categoria.trim() !== '') {
            const categoryName = row.categoria.trim();
            const categoryRepo =
              this.productRepository.manager.getRepository(Category);

            let category = await categoryRepo.findOne({
              where: { name: categoryName },
            });

            // Si no existe, crearla
            if (!category) {
              console.log(`📁 Creando nueva categoría: "${categoryName}"`);
              category = categoryRepo.create({
                name: categoryName,
                description: `Categoría importada desde Excel`,
                is_active: true,
              });
              category = await categoryRepo.save(category);
              console.log(`✅ Categoría creada con ID: ${category.id}`);
            }

            categoryId = category.id;
          }

          // Buscar producto existente por nombre + marca (case-insensitive)
          const productName = row.nombre.trim();
          const productBrand =
            row.marca && row.marca.trim() !== '' ? row.marca.trim() : null;

          let existingProduct = null;
          if (productBrand) {
            existingProduct = await this.productRepository.findOne({
              where: {
                name: productName,
                brand: productBrand,
              },
            });
          } else {
            // Si no tiene marca, buscar solo por nombre
            existingProduct = await this.productRepository.findOne({
              where: {
                name: productName,
                brand: null,
              },
            });
          }

          let product: Product;
          let action: 'created' | 'updated' = 'created';
          let bulkPricesCreated = 0;
          let bulkPricesUpdated = 0;

          if (existingProduct) {
            // Actualizar producto existente
            console.log(
              `🔄 Actualizando producto existente: "${productName}" (ID: ${existingProduct.id})`,
            );

            existingProduct.brand = productBrand;
            existingProduct.category_id = categoryId;
            existingProduct.unit = row.unidad || 'unit';
            existingProduct.sale_price = String(Number(row.precio_venta));
            existingProduct.cost_price = row.precio_compra
              ? String(Number(row.precio_compra))
              : '0';
            existingProduct.stock_quantity =
              row.cantidad_stock !== null && row.cantidad_stock !== undefined
                ? String(Number(row.cantidad_stock))
                : '0';
            existingProduct.minimum_stock =
              row.stock_minimo !== null && row.stock_minimo !== undefined
                ? String(Number(row.stock_minimo))
                : '0';

            product = await this.productRepository.save(existingProduct);
            action = 'updated';
          } else {
            // Crear nuevo producto
            console.log(`✨ Creando nuevo producto: "${productName}"`);

            const productData: CreateProductDto = {
              name: productName,
              sku:
                row.sku && row.sku.trim() !== '' ? row.sku.trim() : undefined,
              brand: productBrand,
              category_id: categoryId,
              unit: row.unidad || 'unit',
              sale_price: Number(row.precio_venta),
              cost_price: row.precio_compra ? Number(row.precio_compra) : 0,
              stock_quantity:
                row.cantidad_stock !== null && row.cantidad_stock !== undefined
                  ? Number(row.cantidad_stock)
                  : 0,
              minimum_stock:
                row.stock_minimo !== null && row.stock_minimo !== undefined
                  ? Number(row.stock_minimo)
                  : 0,
            };

            product = await this.create(productData);
            action = 'created';
          }

          // Procesar precios de mayoreo dinámicamente (detecta cualquier columna mayoreo_X)
          const mayoreoKeys = Object.keys(row).filter((key) =>
            key.startsWith('mayoreo_'),
          );

          for (const key of mayoreoKeys) {
            const minQuantityMatch = key.match(/mayoreo_(\d+)/);
            if (!minQuantityMatch) continue;

            const minQuantity = parseInt(minQuantityMatch[1], 10);
            const value = row[key];

            if (
              value !== null &&
              value !== undefined &&
              value !== '' &&
              !isNaN(Number(value)) &&
              Number(value) > 0
            ) {
              try {
                // Verificar si ya existe un bulk price para esta cantidad
                const existingBulkPrice =
                  await this.bulkPriceRepository.findOne({
                    where: {
                      product_id: product.id,
                      min_quantity: minQuantity,
                    },
                  });

                if (existingBulkPrice) {
                  // Actualizar precio existente
                  existingBulkPrice.sale_bundle_total = String(Number(value));
                  await this.bulkPriceRepository.save(existingBulkPrice);
                  bulkPricesUpdated++;
                  console.log(
                    `   ♻️ Actualizado mayoreo existente para cantidad ${minQuantity}`,
                  );
                } else {
                  // Crear nuevo bulk price
                  await this.addBulkPrice(product.id, {
                    min_quantity: minQuantity,
                    sale_bundle_total: String(Number(value)),
                    pricing_mode: 'bundle_exact',
                  });
                  bulkPricesCreated++;
                  console.log(
                    `   ➕ Creado nuevo mayoreo para cantidad ${minQuantity}`,
                  );
                }
              } catch (bulkError) {
                console.warn(
                  `⚠️ No se pudo procesar mayoreo para cantidad ${minQuantity}: ${bulkError.message}`,
                );
              }
            }
          }

          created_products.push({
            row: rowNumber,
            sheet: sheetName,
            product_name: product.name,
            product_id: product.id,
            action: action,
            bulk_prices_created: bulkPricesCreated,
            bulk_prices_updated: bulkPricesUpdated,
          });

          imported++;
        } catch (error) {
          failed++;
          errors.push({
            row: rowNumber,
            sheet: sheetName,
            product_name: row.nombre || 'Desconocido',
            error: error.message,
          });
        }
      }

      console.log(
        `   ✅ Pestaña "${sheetName}": ${
          imported - (imported - rawData.length + data.length - failed)
        } productos importados`,
      );
    } // Fin del loop de pestañas

    console.log(
      `\n🎉 Importación completada: ${imported} productos de ${workbook.SheetNames.length} pestaña(s)`,
    );

    return {
      success: failed === 0,
      total_rows: totalRows,
      imported,
      failed,
      sheets_processed: workbook.SheetNames.length,
      errors,
      created_products,
    };
  }

  /**
   * Genera un SKU único automáticamente
   * Formato: CAT-XXX-NNNN
   * - CAT: 3 primeras letras de la categoría (o GEN si no tiene)
   * - XXX: 3 primeras letras del nombre del producto
   * - NNNN: Número secuencial de 4 dígitos
   */
  private async generateSKU(
    productName: string,
    categoryId?: string,
  ): Promise<string> {
    // Obtener prefijo de categoría
    let categoryPrefix = 'GEN';
    if (categoryId) {
      const category = await this.productRepository.manager
        .getRepository(Category)
        .findOne({
          where: { id: categoryId },
        });
      if (category && category.name) {
        categoryPrefix = this.sanitizeForSKU(category.name).substring(0, 3);
      }
    }

    // Obtener prefijo del producto
    const productPrefix = this.sanitizeForSKU(productName).substring(0, 3);

    // Obtener el último número secuencial
    const lastProduct = await this.productRepository
      .createQueryBuilder('product')
      .where('product.sku LIKE :pattern', {
        pattern: `${categoryPrefix}-${productPrefix}-%`,
      })
      .orderBy('product.sku', 'DESC')
      .getOne();

    let sequenceNumber = 1;
    if (lastProduct && lastProduct.sku) {
      const lastSequence = lastProduct.sku.split('-')[2];
      sequenceNumber = parseInt(lastSequence, 10) + 1;
    }

    // Formatear número con padding de 4 dígitos
    const formattedNumber = sequenceNumber.toString().padStart(4, '0');

    return `${categoryPrefix}-${productPrefix}-${formattedNumber}`;
  }

  /**
   * Sanitiza texto para usar en SKU
   * Remueve acentos, convierte a mayúsculas y elimina caracteres especiales
   */
  private sanitizeForSKU(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '') // Solo letras y números
      .substring(0, 3);
  }

  /**
   * Remueve acentos/tildes de un texto para búsquedas insensibles a acentos
   * Ejemplo: "cartón" -> "carton", "José" -> "Jose"
   */
  private removeAccents(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remover marcas diacríticas (acentos, tildes)
  }
}
