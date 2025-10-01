import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { LoginUserDto, PaginationDto, UpdateUserDto } from './dto';
import { JwtPayload } from './models/interfaces/jwt-payload.interface';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { PaginatedResponse } from './interfaces/paginated-response.interface';
import { createPaginatedResponse } from './utils/pagination.helper';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}
  async register(createUserDto: CreateUserDto, manager?: EntityManager) {
    try {
      const { password, ...userData } = createUserDto;
      const user = this.userRepository.create({
        ...userData,
        password: bcrypt.hashSync(password, 10),
      });

      if (manager) return await manager.save(user);
      await this.userRepository.save(user);
      delete user.password;
      return {
        ...user,
        token: this.getJwtToken({ userId: user.id }),
      };
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async changePassword(userId: string, newPassword: string) {
    const user = await this.findOne(userId);

    if (!user) throw new NotFoundException('user not found');

    const newUser = {
      ...user,
      password: bcrypt.hashSync(newPassword, 10),
    };
    await this.userRepository.save(newUser);

    return newUser;
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: {
        email: true,
        password: true,
        id: true,
        role: true,
        full_name: true,
      },
    });

    if (!user)
      throw new UnauthorizedException('Credentials are not valid (email)');

    if (!bcrypt.compareSync(password, user.password))
      throw new UnauthorizedException('Credentials are not valid (password)');

    // Remove password from response for security
    delete user.password;

    return {
      user: { ...user },
      token: this.getJwtToken({ userId: user.id }),
    };
  }

  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);

    return token;
  }

  async checkAuthStatus(user: User) {
    return {
      user: user,
      token: this.getJwtToken({ userId: user.id }),
    };
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<User>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const [data, total] = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.isActive')
      .orderBy('user.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    if (!data) throw new NotFoundException('users have not been found');

    return createPaginatedResponse(data, total, limit, offset);
  }

  async findOne(id: string) {
    if (!isUUID(id))
      throw new BadRequestException('id not valid (it must be a UUID)');

    const user = await this.userRepository.findOneBy({ id });

    if (!user) throw new BadRequestException('user not found');

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const { ...rest } = updateUserDto;

    try {
      const user = await this.userRepository.preload({
        id,
        ...rest,
      });

      if (!user) throw new NotFoundException(`Product with id ${id} not found`);

      await this.userRepository.save(user);

      return user;
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async desactivateUser(id: string) {
    const user = await this.findOne(id);

    if (!user) throw new NotFoundException(`User with id ${id} not found`);

    user.isActive = false;
    await this.userRepository.save(user);

    return { message: `user ${user.full_name} has been desactivated` };
  }

  private handleDBErrors(error: any): never {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail);
    }
    console.log(error);
    throw new InternalServerErrorException('Please check server logs');
  }
}
