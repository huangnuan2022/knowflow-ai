export const AI_PROVIDER_STUB = 'stub';
export const AI_PROVIDER_OPENAI = 'openai';

export const DEFAULT_STUB_MODEL = 'stub-tutor-v0';
export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';

export const ALLOWED_AI_PROVIDERS = [AI_PROVIDER_STUB, AI_PROVIDER_OPENAI] as const;
export const ALLOWED_AI_MODELS_BY_PROVIDER = {
  [AI_PROVIDER_STUB]: [DEFAULT_STUB_MODEL],
  [AI_PROVIDER_OPENAI]: [DEFAULT_OPENAI_MODEL, 'gpt-5.4-nano'],
} as const;

export type AiProviderId = (typeof ALLOWED_AI_PROVIDERS)[number];
export type AiModelId =
  (typeof ALLOWED_AI_MODELS_BY_PROVIDER)[AiProviderId][number];
