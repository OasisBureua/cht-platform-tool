import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports: [
        ConfigModule,
        PrismaModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({}),
    ],
    providers: [JwtStrategy],
    exports: [PassportModule, JwtModule],
})
export class AuthModule {}