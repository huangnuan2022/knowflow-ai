import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { requireRecord } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(createUserDto: CreateUserDto) {
    const data: Prisma.UserCreateInput = {
      displayName: createUserDto.displayName,
      email: createUserDto.email,
      settings: createUserDto.settings as Prisma.InputJsonValue | undefined,
    };

    return this.prisma.user.create({ data });
  }

  findAll() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return requireRecord(user, 'User', id);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id);
    const data: Prisma.UserUpdateInput = {
      displayName: updateUserDto.displayName,
      email: updateUserDto.email,
      settings: updateUserDto.settings as Prisma.InputJsonValue | undefined,
    };

    return this.prisma.user.update({ data, where: { id } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.delete({ where: { id } });
  }
}
