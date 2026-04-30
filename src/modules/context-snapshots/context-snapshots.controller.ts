import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CreateContextSnapshotDto } from './dto/create-context-snapshot.dto';
import { ContextSnapshotsService } from './context-snapshots.service';

@Controller('context-snapshots')
export class ContextSnapshotsController {
  constructor(private readonly contextSnapshotsService: ContextSnapshotsService) {}

  @Post()
  create(@Body() createContextSnapshotDto: CreateContextSnapshotDto) {
    return this.contextSnapshotsService.create(createContextSnapshotDto);
  }

  @Get()
  findAll(@Query('runId') runId?: string) {
    return this.contextSnapshotsService.findAll(runId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contextSnapshotsService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contextSnapshotsService.remove(id);
  }
}
