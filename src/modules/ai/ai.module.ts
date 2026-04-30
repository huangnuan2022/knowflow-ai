import { Module } from '@nestjs/common';
import { AiProviderRegistry } from './providers/ai-provider.registry';
import { OpenAiClientFactory } from './providers/openai-client.factory';
import { OpenAiProvider } from './providers/openai.provider';
import { StubAiProvider } from './providers/stub-ai.provider';

@Module({
  exports: [AiProviderRegistry],
  providers: [AiProviderRegistry, OpenAiClientFactory, OpenAiProvider, StubAiProvider],
})
export class AiModule {}
