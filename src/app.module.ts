import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BranchesModule } from './modules/branches/branches.module';
import { DemoSeedModule } from './modules/demo-seed/demo-seed.module';
import { EdgesModule } from './modules/edges/edges.module';
import { GraphsModule } from './modules/graphs/graphs.module';
import { HealthModule } from './modules/health/health.module';
import { HighlightsModule } from './modules/highlights/highlights.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NodesModule } from './modules/nodes/nodes.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RunsModule } from './modules/runs/runs.module';
import { ContextSnapshotsModule } from './modules/context-snapshots/context-snapshots.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    DemoSeedModule,
    BranchesModule,
    UsersModule,
    ProjectsModule,
    GraphsModule,
    NodesModule,
    EdgesModule,
    MessagesModule,
    HighlightsModule,
    RunsModule,
    ContextSnapshotsModule,
  ],
})
export class AppModule {}
