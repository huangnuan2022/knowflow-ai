import { ConfigService } from '@nestjs/config';
import { DEFAULT_OPENAI_MODEL, OpenAiProvider } from '../src/modules/ai/providers/openai.provider';
import { OpenAiClientFactory, OpenAiResponsesClient } from '../src/modules/ai/providers/openai-client.factory';

describe('OpenAiProvider', () => {
  it('calls the Responses API through the provider-neutral adapter shape', async () => {
    const create = jest.fn().mockResolvedValue({
      output_text: 'Path compression flattens the tree after find.',
      usage: {
        input_tokens: 19,
        output_tokens: 11,
      },
    });
    const provider = createProvider({
      client: { responses: { create } },
      config: { OPENAI_MODEL: DEFAULT_OPENAI_MODEL },
    });

    const result = await provider.complete({
      messages: [
        { content: 'You are KnowFlow.', role: 'system' },
        { content: 'Explain path compression.', role: 'user' },
      ],
      model: '',
      runId: 'run_test',
      selectedTextSnapshot: 'path compression',
    });

    expect(create).toHaveBeenCalledWith({
      input: [
        { content: 'You are KnowFlow.', role: 'system', type: 'message' },
        { content: 'Explain path compression.', role: 'user', type: 'message' },
      ],
      model: DEFAULT_OPENAI_MODEL,
      stream: false,
    });
    expect(result).toEqual({
      content: 'Path compression flattens the tree after find.',
      inputTokens: 19,
      outputTokens: 11,
    });
  });

  it('lets the persisted run model override the configured default model', async () => {
    const create = jest.fn().mockResolvedValue({ output_text: 'A stronger answer.' });
    const provider = createProvider({
      client: { responses: { create } },
      config: { OPENAI_MODEL: DEFAULT_OPENAI_MODEL },
    });

    await provider.complete({
      messages: [{ content: 'Explain amortized complexity.', role: 'user' }],
      model: 'gpt-5.4',
      runId: 'run_model_override',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4',
      }),
    );
  });

  it('fails clearly when OpenAI returns no output text', async () => {
    const provider = createProvider({
      client: { responses: { create: jest.fn().mockResolvedValue({ output_text: '' }) } },
      config: {},
    });

    await expect(
      provider.complete({
        messages: [{ content: 'Explain union by rank.', role: 'user' }],
        model: DEFAULT_OPENAI_MODEL,
        runId: 'run_empty_response',
      }),
    ).rejects.toThrow('OpenAI response did not include output_text');
  });

  it('does not leak generic provider error details', async () => {
    const create = jest.fn().mockRejectedValue(new Error('raw provider body with sk-test-secret and prompt text'));
    const provider = createProvider({
      client: { responses: { create } },
      config: {},
    });

    await expect(
      provider.complete({
        messages: [{ content: 'Explain a private topic.', role: 'user' }],
        model: DEFAULT_OPENAI_MODEL,
        runId: 'run_provider_error',
      }),
    ).rejects.toThrow('OpenAI request failed before a usable response was returned');

    await expect(
      provider.complete({
        messages: [{ content: 'Explain a private topic.', role: 'user' }],
        model: DEFAULT_OPENAI_MODEL,
        runId: 'run_provider_error_again',
      }),
    ).rejects.not.toThrow('sk-test-secret');
  });
});

describe('OpenAiClientFactory', () => {
  it('requires OPENAI_API_KEY only when creating the runtime client', () => {
    const factory = new OpenAiClientFactory(createConfigService({}));

    expect(() => factory.create()).toThrow('OPENAI_API_KEY is required');
  });
});

function createProvider(input: { client: OpenAiResponsesClient; config: Record<string, string | undefined> }) {
  const factory = {
    create: jest.fn(() => input.client),
  } as unknown as OpenAiClientFactory;

  return new OpenAiProvider(factory, createConfigService(input.config));
}

function createConfigService(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}
