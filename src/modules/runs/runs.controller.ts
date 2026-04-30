import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RunStatus } from '@prisma/client';
import { CreateRunDto } from './dto/create-run.dto';
import { UpdateRunDto } from './dto/update-run.dto';
import { RunsService } from './runs.service';

@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post()
  create(@Body() createRunDto: CreateRunDto) {
    return this.runsService.create(createRunDto);
  }

  @Get()
  findAll(@Query('nodeId') nodeId?: string, @Query('status') status?: RunStatus) {
    return this.runsService.findAll(nodeId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.runsService.findOne(id);
  }

  @Post(':id/execute')
  execute(@Param('id') id: string) {
    return this.runsService.execute(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRunDto: UpdateRunDto) {
    return this.runsService.update(id, updateRunDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.runsService.remove(id);
  }
}
