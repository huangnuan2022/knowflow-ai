import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { NodesService } from './nodes.service';

@Controller('nodes')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Post()
  create(@Body() createNodeDto: CreateNodeDto) {
    return this.nodesService.create(createNodeDto);
  }

  @Get()
  findAll(@Query('graphId') graphId?: string) {
    return this.nodesService.findAll(graphId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.nodesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNodeDto: UpdateNodeDto) {
    return this.nodesService.update(id, updateNodeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.nodesService.remove(id);
  }
}
