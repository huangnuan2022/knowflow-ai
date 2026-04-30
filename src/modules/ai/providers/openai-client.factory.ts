import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';

export type OpenAiResponse = {
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  } | null;
};

export type OpenAiResponsesClient = {
  responses: {
    create(params: ResponseCreateParamsNonStreaming): PromiseLike<OpenAiResponse>;
  };
};

@Injectable()
export class OpenAiClientFactory {
  constructor(private readonly configService: ConfigService) {}

  create(): OpenAiResponsesClient {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when executing runs with provider "openai"');
    }

    return new OpenAI({
      apiKey,
      logLevel: 'warn',
      maxRetries: 1,
      timeout: 60_000,
    }) as OpenAiResponsesClient;
  }
}
