import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const RequireCompany = (companyId?: string) => {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    const key = propertyKey || target;
    Reflect.defineMetadata('requireCompany', companyId || true, target, key);
  };
};

@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireCompany = this.reflector.get<string | boolean>('requireCompany', context.getHandler());
    
    if (!requireCompany) {
      return true; // No company requirement
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    
    if (!request.user || !request.company) {
      throw new ForbiddenException('Company access required');
    }

    // If a specific company ID is required, validate it
    if (typeof requireCompany === 'string') {
      if (request.user.companyId !== requireCompany) {
        throw new ForbiddenException('Access denied for this company');
      }
    }

    return true;
  }
}