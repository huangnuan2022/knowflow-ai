import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GraphsController } from './graphs.controller';
import { GraphsService } from './graphs.service';

@Module({
  controllers: [GraphsController],
  imports: [PrismaModule],
  providers: [GraphsService],
})
export class GraphsModule {}
