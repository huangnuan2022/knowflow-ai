import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { RunStatus } from '@prisma/client';
import { AiRunRateLimiter } from '../ai/ai-run-rate-limiter.service';
import { CreateRunDto } from './dto/create-run.dto';
import { UpdateRunDto } from './dto/update-run.dto';
import { RunsService } from './runs.service';

type RequestLike = {
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
};

@Controller('runs')
export class RunsController {
  constructor(
    private readonly aiRunRateLimiter: AiRunRateLimiter,
    private readonly runsService: RunsService,
  ) {}

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
  execute(@Param('id') id: string, @Req() request: RequestLike) {
    this.aiRunRateLimiter.assertCanExecute(clientKeyFromRequest(request));
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

function clientKeyFromRequest(request: RequestLike) {
  return request.ip || request.socket?.remoteAddress || 'unknown-client';
}
