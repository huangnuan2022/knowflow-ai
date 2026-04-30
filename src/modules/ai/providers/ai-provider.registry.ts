import { Injectable } from '@nestjs/common';
import { AiProvider } from './ai-provider.interface';
import { StubAiProvider } from './stub-ai.provider';

@Injectable()
export class AiProviderRegistry {
  private readonly providers: Map<string, AiProvider>;

  constructor(stubAiProvider: StubAiProvider) {
    this.providers = new Map([[stubAiProvider.id, stubAiProvider]]);
  }

  get(providerId: string): AiProvider | undefined {
    return this.providers.get(providerId);
  }
}
