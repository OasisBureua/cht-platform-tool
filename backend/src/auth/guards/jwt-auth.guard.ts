import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    // Check if route is markeed as public
    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.get<boolean>(
            'isPublic',
            context.getHandler(),
        );

        if (isPublic) {
            return true; // Skip authentication for public routes
        }

        return super.canActivate(context);
    }
}