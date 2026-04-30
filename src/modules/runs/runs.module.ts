import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  controllers: [RunsController],
  imports: [PrismaModule],
  providers: [RunsService],
})
export class RunsModule {}
