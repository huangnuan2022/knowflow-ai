import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RateLimitBucket = {
  count: number;
  windowStartedAt: number;
};

@Injectable()
export class AiRunRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(private readonly configService: ConfigService) {}

  assertCanExecute(key: string) {
    const maxRequests = readPositiveInteger(this.configService.get<string>('AI_RUN_RATE_LIMIT_MAX'), 10);
    if (maxRequests <= 0) {
      return;
    }

    const windowMs = readPositiveInteger(this.configService.get<string>('AI_RUN_RATE_LIMIT_WINDOW_MS'), 60_000);
    const now = Date.now();
    const currentBucket = this.buckets.get(key);

    if (!currentBucket || now - currentBucket.windowStartedAt >= windowMs) {
      this.buckets.set(key, { count: 1, windowStartedAt: now });
      this.pruneExpiredBuckets(now, windowMs);
      return;
    }

    if (currentBucket.count >= maxRequests) {
      throw new HttpException('AI run rate limit exceeded. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    currentBucket.count += 1;
  }

  private pruneExpiredBuckets(now: number, windowMs: number) {
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.windowStartedAt >= windowMs) {
        this.buckets.delete(key);
      }
    }
  }
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
