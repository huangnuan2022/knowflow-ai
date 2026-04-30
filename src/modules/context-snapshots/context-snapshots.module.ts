import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ContextSnapshotsController } from './context-snapshots.controller';
import { ContextSnapshotsService } from './context-snapshots.service';

@Module({
  controllers: [ContextSnapshotsController],
  imports: [PrismaModule],
  providers: [ContextSnapshotsService],
})
export class ContextSnapshotsModule {}
