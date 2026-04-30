import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AI_PROVIDER_OPENAI,
  AI_PROVIDER_STUB,
  AiProviderId,
  ALLOWED_AI_MODELS_BY_PROVIDER,
  ALLOWED_AI_PROVIDERS,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_STUB_MODEL,
} from './ai.constants';

export type RunAiConfigInput = {
  model?: string;
  provider?: string;
};

export type ResolvedRunAiConfig = {
  model: string;
  provider: AiProviderId;
};

@Injectable()
export class AiRunConfigService {
  constructor(private readonly configService: ConfigService) {}

  resolveRunConfig(input: RunAiConfigInput = {}): ResolvedRunAiConfig {
    const provider = this.resolveProvider(input.provider);
    const model = this.resolveModel(provider, input.model);

    return {
      model,
      provider,
    };
  }

  private resolveProvider(inputProvider?: string): AiProviderId {
    const provider =
      trimToUndefined(inputProvider) ??
      trimToUndefined(this.configService.get<string>('AI_PROVIDER')) ??
      AI_PROVIDER_STUB;

    if (!isAllowedProvider(provider)) {
      throw new BadRequestException(
        `AI provider "${provider}" is not allowed. Allowed providers: ${ALLOWED_AI_PROVIDERS.join(', ')}`,
      );
    }

    return provider;
  }

  private resolveModel(provider: AiProviderId, inputModel?: string) {
    const model =
      trimToUndefined(inputModel) ??
      trimToUndefined(this.configService.get<string>('AI_MODEL')) ??
      (provider === AI_PROVIDER_OPENAI
        ? trimToUndefined(this.configService.get<string>('OPENAI_MODEL'))
        : undefined) ??
      defaultModelForProvider(provider);

    const allowedModels = ALLOWED_AI_MODELS_BY_PROVIDER[provider];
    if (!(allowedModels as readonly string[]).includes(model)) {
      throw new BadRequestException(
        `AI model "${model}" is not allowed for provider "${provider}". Allowed models: ${allowedModels.join(', ')}`,
      );
    }

    return model;
  }
}

function defaultModelForProvider(provider: AiProviderId) {
  return provider === AI_PROVIDER_OPENAI ? DEFAULT_OPENAI_MODEL : DEFAULT_STUB_MODEL;
}

function isAllowedProvider(provider: string): provider is AiProviderId {
  return (ALLOWED_AI_PROVIDERS as readonly string[]).includes(provider);
}

function trimToUndefined(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
