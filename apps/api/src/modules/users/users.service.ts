import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.client.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.client.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.client.user.update({
      where: { id },
      data: { password: passwordHash, passwordChangedAt: new Date() },
    });
  }
}
