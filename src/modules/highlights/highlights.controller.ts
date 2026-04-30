import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CreateHighlightDto } from './dto/create-highlight.dto';
import { HighlightsService } from './highlights.service';

@Controller('highlights')
export class HighlightsController {
  constructor(private readonly highlightsService: HighlightsService) {}

  @Post()
  create(@Body() createHighlightDto: CreateHighlightDto) {
    return this.highlightsService.create(createHighlightDto);
  }

  @Get()
  findAll(@Query('messageId') messageId?: string) {
    return this.highlightsService.findAll(messageId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.highlightsService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.highlightsService.remove(id);
  }
}
