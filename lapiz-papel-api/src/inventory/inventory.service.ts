import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { CreateInventoryMovementDto } from './dto';
import { PaginationDto } from '../auth/dto';
import { User } from '../auth/entities/user.entity';
import { PaginatedResponse } from '../auth/interfaces/paginated-response.interface';
import { createPaginatedResponse } from '../auth/utils/pagination.helper';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryMovement)
    private readonly inventoryMovementRepository: Repository<InventoryMovement>,
  ) {}

  async create(
    createInventoryMovementDto: CreateInventoryMovementDto,
    user: User,
  ): Promise<InventoryMovement> {
    const inventoryMovement = this.inventoryMovementRepository.create({
      ...createInventoryMovementDto,
      created_by: user.id,
    });
    return await this.inventoryMovementRepository.save(inventoryMovement);
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<InventoryMovement>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const [data, total] = await this.inventoryMovementRepository.findAndCount({
      take: limit,
      skip: offset,
      order: { created_at: 'DESC' },
      relations: ['product', 'creator'],
    });

    return createPaginatedResponse(data, total, limit, offset);
  }

  async findOne(id: string): Promise<InventoryMovement> {
    const inventoryMovement = await this.inventoryMovementRepository.findOne({
      where: { id },
      relations: ['product', 'creator'],
    });

    if (!inventoryMovement) {
      throw new NotFoundException('Inventory movement not found');
    }

    return inventoryMovement;
  }

  async findByProduct(
    productId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<InventoryMovement>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const [data, total] = await this.inventoryMovementRepository.findAndCount({
      where: { product_id: productId },
      take: limit,
      skip: offset,
      order: { created_at: 'DESC' },
      relations: ['product', 'creator'],
    });

    return createPaginatedResponse(data, total, limit, offset);
  }

  async getMovementsByType(
    movementType: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<InventoryMovement>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const [data, total] = await this.inventoryMovementRepository.findAndCount({
      where: { movement_type: movementType },
      take: limit,
      skip: offset,
      order: { created_at: 'DESC' },
      relations: ['product', 'creator'],
    });

    return createPaginatedResponse(data, total, limit, offset);
  }
}
