import { Module } from '@nestjs/common';
import { AiProviderRegistry } from './providers/ai-provider.registry';
import { StubAiProvider } from './providers/stub-ai.provider';

@Module({
  exports: [AiProviderRegistry],
  providers: [AiProviderRegistry, StubAiProvider],
})
export class AiModule {}
