import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EdgesController } from './edges.controller';
import { EdgesService } from './edges.service';

@Module({
  controllers: [EdgesController],
  imports: [PrismaModule],
  providers: [EdgesService],
})
export class EdgesModule {}
