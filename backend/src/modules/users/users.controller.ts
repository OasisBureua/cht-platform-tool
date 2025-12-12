import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}
    
    @Post()
    @Roles('ADMIN') // <- Only admins can create users manually
    create(@Body() createUserDto: CreateUserDto) {
        return this.usersService.create(createUserDto);
    }

    @Get()
    @Roles('ADMIN')  // ← Only admins can list all users
    findAll(
        @Query('page', new ParseIntPipe({ optional: true})) page?: number,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    ) {
        return this.usersService.findAll(page, limit);
    }

    @Get('me')
    // No @Roles() = any authenticated user can access
    getCurrentUser(@CurrentUser() user: any) {
        return this.usersService.findByAuthId(user.userId);
    }

    @Get(':id')
    @Roles('ADMIN')  // ← Only admins can view other users
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    @Patch(':id')
    @Roles('ADMIN')  // ← Only admins can update users
    update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(id, updateUserDto);
    }

    @Delete(':id')
    @Roles('ADMIN')  // ← Only admins can delete users
    remove(@Param('id') id: string) {
        return this.usersService.remove(id);
    }
}