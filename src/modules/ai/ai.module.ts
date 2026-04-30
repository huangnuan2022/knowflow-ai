import { Module } from '@nestjs/common';
import { AiRunConfigService } from './ai-run-config.service';
import { AiRunRateLimiter } from './ai-run-rate-limiter.service';
import { AiProviderRegistry } from './providers/ai-provider.registry';
import { OpenAiClientFactory } from './providers/openai-client.factory';
import { OpenAiProvider } from './providers/openai.provider';
import { StubAiProvider } from './providers/stub-ai.provider';

@Module({
  exports: [AiProviderRegistry, AiRunConfigService, AiRunRateLimiter],
  providers: [AiProviderRegistry, AiRunConfigService, AiRunRateLimiter, OpenAiClientFactory, OpenAiProvider, StubAiProvider],
})
export class AiModule {}
