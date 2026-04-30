import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HighlightsController } from './highlights.controller';
import { HighlightsService } from './highlights.service';

@Module({
  controllers: [HighlightsController],
  imports: [PrismaModule],
  providers: [HighlightsService],
})
export class HighlightsModule {}
