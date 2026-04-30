import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { UpdateEdgeDto } from './dto/update-edge.dto';
import { EdgesService } from './edges.service';

@Controller('edges')
export class EdgesController {
  constructor(private readonly edgesService: EdgesService) {}

  @Post()
  create(@Body() createEdgeDto: CreateEdgeDto) {
    return this.edgesService.create(createEdgeDto);
  }

  @Get()
  findAll(@Query('graphId') graphId?: string) {
    return this.edgesService.findAll(graphId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.edgesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEdgeDto: UpdateEdgeDto) {
    return this.edgesService.update(id, updateEdgeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.edgesService.remove(id);
  }
}
