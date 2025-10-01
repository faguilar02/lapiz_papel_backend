import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  SearchCategoriesDto,
} from './dto';
import { PaginationDto } from '../auth/dto';
import { PaginatedResponse } from '../auth/interfaces/paginated-response.interface';
import { createPaginatedResponse } from '../auth/utils/pagination.helper';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    try {
      const category = this.categoryRepository.create(createCategoryDto);
      return await this.categoryRepository.save(category);
    } catch (error) {
      if (error.code === '23505') {
        // Unique constraint violation
        throw new ConflictException('Category name already exists');
      }
      throw error;
    }
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<Category>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const [data, total] = await this.categoryRepository
      .createQueryBuilder('category')
      .addSelect('category.is_active')
      .orderBy('category.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return createPaginatedResponse(data, total, limit, offset);
  }

  async search(
    searchDto: SearchCategoriesDto,
  ): Promise<PaginatedResponse<Category>> {
    const { search, limit = 20, offset = 0 } = searchDto;

    console.log('🔍 Categories Service: search called with:', searchDto);

    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .addSelect('category.is_active')
      .orderBy('category.created_at', 'DESC');

    if (search) {
      queryBuilder.where('category.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    const [data, total] = await queryBuilder
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    console.log('🔍 Categories Service: found', total, 'categories');
    return createPaginatedResponse(data, total, limit, offset);
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['products'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id);

    try {
      Object.assign(category, updateCategoryDto);
      return await this.categoryRepository.save(category);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Category name already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    category.is_active = false;
    await this.categoryRepository.save(category);
  }

  async activate(id: string): Promise<Category> {
    const category = await this.findOne(id);
    category.is_active = true;
    return await this.categoryRepository.save(category);
  }

  async deactivate(id: string): Promise<Category> {
    const category = await this.findOne(id);
    category.is_active = false;
    return await this.categoryRepository.save(category);
  }
}
