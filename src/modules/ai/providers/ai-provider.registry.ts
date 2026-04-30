import { Injectable } from '@nestjs/common';
import { AiProvider } from './ai-provider.interface';
import { OpenAiProvider } from './openai.provider';
import { StubAiProvider } from './stub-ai.provider';

@Injectable()
export class AiProviderRegistry {
  private readonly providers: Map<string, AiProvider>;

  constructor(stubAiProvider: StubAiProvider, openAiProvider: OpenAiProvider) {
    this.providers = new Map<string, AiProvider>([
      [stubAiProvider.id, stubAiProvider],
      [openAiProvider.id, openAiProvider],
    ]);
  }

  get(providerId: string): AiProvider | undefined {
    return this.providers.get(providerId);
  }
}
