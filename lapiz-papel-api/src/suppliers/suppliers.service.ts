import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  SearchSuppliersDto,
} from './dto';
import { PaginationDto } from '../auth/dto';
import { PaginatedResponse } from '../auth/interfaces/paginated-response.interface';
import { createPaginatedResponse } from '../auth/utils/pagination.helper';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  async create(createSupplierDto: CreateSupplierDto): Promise<Supplier> {
    const supplier = this.supplierRepository.create(createSupplierDto);
    return await this.supplierRepository.save(supplier);
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<Supplier>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const [data, total] = await this.supplierRepository
      .createQueryBuilder('supplier')
      .addSelect('supplier.is_active')
      .orderBy('supplier.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return createPaginatedResponse(data, total, limit, offset);
  }

  async findOne(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { id },
      relations: ['purchases'],
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(
    id: string,
    updateSupplierDto: UpdateSupplierDto,
  ): Promise<Supplier> {
    const supplier = await this.findOne(id);
    Object.assign(supplier, updateSupplierDto);
    return await this.supplierRepository.save(supplier);
  }

  async remove(id: string): Promise<void> {
    const supplier = await this.findOne(id);
    supplier.is_active = false;
    await this.supplierRepository.save(supplier);
  }

  async search(
    searchDto: SearchSuppliersDto,
  ): Promise<PaginatedResponse<Supplier>> {
    const { search, ruc, limit = 20, offset = 0 } = searchDto;

    console.log('🔍 Suppliers Service: search called with:', searchDto);

    const queryBuilder = this.supplierRepository
      .createQueryBuilder('supplier')
      .addSelect('supplier.is_active')
      .orderBy('supplier.created_at', 'DESC');

    // Búsqueda específica por RUC
    if (ruc) {
      queryBuilder.where('supplier.ruc ILIKE :ruc', { ruc: `%${ruc}%` });
    }
    // Búsqueda general
    else if (search) {
      queryBuilder.where(
        '(supplier.name ILIKE :search OR supplier.contact_person ILIKE :search OR supplier.phone ILIKE :search OR supplier.ruc ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await queryBuilder
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    console.log('🔍 Suppliers Service: found', total, 'suppliers');
    return createPaginatedResponse(data, total, limit, offset);
  }

  async findByRuc(ruc: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { ruc },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async activate(id: string): Promise<Supplier> {
    const supplier = await this.findOne(id);
    supplier.is_active = true;
    return await this.supplierRepository.save(supplier);
  }

  async deactivate(id: string): Promise<Supplier> {
    const supplier = await this.findOne(id);
    supplier.is_active = false;
    return await this.supplierRepository.save(supplier);
  }
}
