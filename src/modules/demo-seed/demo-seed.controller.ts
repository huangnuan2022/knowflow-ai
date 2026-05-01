import { Controller, Post } from '@nestjs/common';
import { DemoSeedService } from './demo-seed.service';

@Controller('demo-seed')
export class DemoSeedController {
  constructor(private readonly demoSeedService: DemoSeedService) {}

  @Post('system-design')
  seedSystemDesignDemo() {
    return this.demoSeedService.seedSystemDesignDemo();
  }
}
