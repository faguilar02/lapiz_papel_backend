import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { User } from '../entities/user.entity';
import { META_ROLE } from '../decorators/role-protected.decorator';
import { UserRole } from '../models/enums';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const validRoles: UserRole[] = this.reflector.get<UserRole[]>(META_ROLE, context.getHandler());
    
    // Si no se definieron roles, permite el acceso
    if (!validRoles || validRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as User;

    if (!user) throw new BadRequestException('User not found');

    // Comprueba si el rol del usuario está incluido en el array de roles válidos
    if (validRoles.includes(user.role)) return true;

    throw new ForbiddenException(`User ${user.full_name} need a valid role: (${validRoles.join(', ')})`);
  }
}
