import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { EasyInputMessage } from 'openai/resources/responses/responses';
import { DEFAULT_OPENAI_MODEL } from '../ai.constants';
import { AiCompletionRequest, AiCompletionResult, AiProvider } from './ai-provider.interface';
import { OpenAiClientFactory, OpenAiResponsesClient } from './openai-client.factory';

export { DEFAULT_OPENAI_MODEL };

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly id = 'openai';
  private client?: OpenAiResponsesClient;

  constructor(
    private readonly clientFactory: OpenAiClientFactory,
    private readonly configService: ConfigService,
  ) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    try {
      const response = await this.getClient().responses.create({
        input: toResponseInput(request),
        model: resolveModel(request.model, this.configService.get<string>('OPENAI_MODEL')),
        stream: false,
      });

      const content = response.output_text?.trim();
      if (!content) {
        throw new Error('OpenAI response did not include output_text');
      }

      return {
        content,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      };
    } catch (error) {
      throw new Error(toSafeOpenAiErrorMessage(error));
    }
  }

  private getClient() {
    this.client ??= this.clientFactory.create();
    return this.client;
  }
}

function toResponseInput(request: AiCompletionRequest): EasyInputMessage[] {
  return request.messages.map((message) => ({
    content: message.content,
    role: message.role,
    type: 'message',
  }));
}

function resolveModel(requestModel: string, configuredModel?: string) {
  return requestModel.trim() || configuredModel?.trim() || DEFAULT_OPENAI_MODEL;
}

function toSafeOpenAiErrorMessage(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    const status = error.status ? ` status ${error.status}` : '';
    const requestId = error.requestID ? ` request ${error.requestID}` : '';
    return `OpenAI request failed with${status || ' unknown status'} (${error.name})${requestId}`;
  }

  if (error instanceof Error) {
    if (
      error.message.includes('OPENAI_API_KEY is required') ||
      error.message === 'OpenAI response did not include output_text'
    ) {
      return error.message;
    }

    return 'OpenAI request failed before a usable response was returned';
  }

  return 'OpenAI request failed';
}
