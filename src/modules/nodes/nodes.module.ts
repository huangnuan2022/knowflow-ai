import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';

@Module({
  controllers: [NodesController],
  imports: [PrismaModule],
  providers: [NodesService],
})
export class NodesModule {}
