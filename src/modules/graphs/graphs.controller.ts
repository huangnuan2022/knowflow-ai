import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateGraphDto } from './dto/create-graph.dto';
import { UpdateGraphDto } from './dto/update-graph.dto';
import { GraphsService } from './graphs.service';

@Controller('graphs')
export class GraphsController {
  constructor(private readonly graphsService: GraphsService) {}

  @Post()
  create(@Body() createGraphDto: CreateGraphDto) {
    return this.graphsService.create(createGraphDto);
  }

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.graphsService.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.graphsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGraphDto: UpdateGraphDto) {
    return this.graphsService.update(id, updateGraphDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.graphsService.remove(id);
  }
}
