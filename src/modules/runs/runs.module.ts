import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ContextBuilderModule } from '../context-builder/context-builder.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  controllers: [RunsController],
  imports: [AiModule, ContextBuilderModule, PrismaModule],
  providers: [RunsService],
})
export class RunsModule {}
