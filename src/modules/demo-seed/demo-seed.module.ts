import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { DemoSeedController } from './demo-seed.controller';
import { DemoSeedService } from './demo-seed.service';

@Module({
  controllers: [DemoSeedController],
  imports: [AiModule, PrismaModule],
  providers: [DemoSeedService],
})
export class DemoSeedModule {}
