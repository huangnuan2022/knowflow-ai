export type AiProviderMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiCompletionRequest = {
  runId: string;
  model: string;
  messages: AiProviderMessage[];
  selectedTextSnapshot?: string | null;
};

export type AiCompletionResult = {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
};

export interface AiProvider {
  readonly id: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
