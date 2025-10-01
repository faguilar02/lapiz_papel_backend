import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../models/enums';

export const META_ROLE = 'role'

export const RoleProtected = (...args: UserRole[]) =>
 {
    return  SetMetadata(META_ROLE, args);
 }
