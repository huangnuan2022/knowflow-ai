import { NotFoundException } from '@nestjs/common';

export function requireRecord<T>(record: T | null, resource: string, id: string): T {
  if (!record) {
    throw new NotFoundException(`${resource} ${id} was not found`);
  }

  return record;
}
