import { Injectable } from '@nestjs/common';
import { AI_PROVIDER_STUB } from '../ai.constants';
import { AiCompletionRequest, AiCompletionResult, AiProvider } from './ai-provider.interface';

@Injectable()
export class StubAiProvider implements AiProvider {
  readonly id = AI_PROVIDER_STUB;

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const focus = request.selectedTextSnapshot?.trim() || lastUserMessage(request) || 'the selected concept';
    const content = `Stub response for "${focus}". Replace this provider with a real model adapter after the core branch workflow is stable.`;

    return {
      content,
      inputTokens: estimateTokenCount(request.messages.map((message) => message.content).join(' ')),
      outputTokens: estimateTokenCount(content),
    };
  }
}

function lastUserMessage(request: AiCompletionRequest) {
  return [...request.messages].reverse().find((message) => message.role === 'user')?.content;
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}
