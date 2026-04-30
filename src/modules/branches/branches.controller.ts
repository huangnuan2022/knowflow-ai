import { Body, Controller, Post } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchFromSelectionDto } from './dto/create-branch-from-selection.dto';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post('from-selection')
  createFromSelection(@Body() createBranchDto: CreateBranchFromSelectionDto) {
    return this.branchesService.createFromSelection(createBranchDto);
  }
}
