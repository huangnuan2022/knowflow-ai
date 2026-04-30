import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ContextBuilderService } from './context-builder.service';

@Module({
  exports: [ContextBuilderService],
  imports: [PrismaModule],
  providers: [ContextBuilderService],
})
export class ContextBuilderModule {}
