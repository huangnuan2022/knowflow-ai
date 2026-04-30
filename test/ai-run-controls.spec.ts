import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiRunConfigService } from '../src/modules/ai/ai-run-config.service';
import { AiRunRateLimiter } from '../src/modules/ai/ai-run-rate-limiter.service';

describe('AiRunConfigService', () => {
  it('defaults local runs to the deterministic stub provider', () => {
    const service = new AiRunConfigService(createConfigService({}));

    expect(service.resolveRunConfig()).toEqual({
      model: 'stub-tutor-v0',
      provider: 'stub',
    });
  });

  it('resolves OpenAI defaults from backend environment configuration', () => {
    const service = new AiRunConfigService(
      createConfigService({
        AI_MODEL: 'gpt-5.4-mini',
        AI_PROVIDER: 'openai',
      }),
    );

    expect(service.resolveRunConfig()).toEqual({
      model: 'gpt-5.4-mini',
      provider: 'openai',
    });
  });

  it('uses OPENAI_MODEL as a compatibility fallback for OpenAI runs', () => {
    const service = new AiRunConfigService(
      createConfigService({
        AI_PROVIDER: 'openai',
        OPENAI_MODEL: 'gpt-5.4-nano',
      }),
    );

    expect(service.resolveRunConfig()).toEqual({
      model: 'gpt-5.4-nano',
      provider: 'openai',
    });
  });

  it('rejects disallowed providers and provider/model mismatches', () => {
    const service = new AiRunConfigService(createConfigService({}));

    expect(() => service.resolveRunConfig({ provider: 'browser-openai' })).toThrow(BadRequestException);
    expect(() => service.resolveRunConfig({ model: 'gpt-5.4-mini', provider: 'stub' })).toThrow(BadRequestException);
  });
});

describe('AiRunRateLimiter', () => {
  it('limits execute-run calls by client key inside the configured window', () => {
    const limiter = new AiRunRateLimiter(
      createConfigService({
        AI_RUN_RATE_LIMIT_MAX: '2',
        AI_RUN_RATE_LIMIT_WINDOW_MS: '60000',
      }),
    );

    limiter.assertCanExecute('127.0.0.1');
    limiter.assertCanExecute('127.0.0.1');

    expect(() => limiter.assertCanExecute('127.0.0.1')).toThrow(HttpException);
    try {
      limiter.assertCanExecute('127.0.0.1');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
    expect(() => limiter.assertCanExecute('127.0.0.2')).not.toThrow();
  });
});

function createConfigService(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}
