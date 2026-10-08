import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import * as classTransformer from 'class-transformer';
import { Expose } from 'class-transformer';
import { describe, expect, it } from 'vitest';

import { NominalSerializerInterceptor } from '../../../src/adapters/nest/index.ts';
import { Email } from '../../../src/index.ts';

class Account {
  public readonly email: Email | undefined;
  readonly #secret = 'secret';

  public constructor(email: Email | undefined) {
    this.email = email;
  }

  @Expose()
  public get hint(): string {
    return this.#secret;
  }
}

describe('NominalSerializerInterceptor and #private fields', () => {
  const interceptor = new NominalSerializerInterceptor(new Reflector(), {
    transformerPackage: classTransformer,
  });

  it('throws for a getter that reads a #private field of an object it had to copy', () => {
    expect(() => interceptor.serialize(new Account(new Email('jane@example.com')), {})).toThrow(
      'Cannot read private member',
    );
  });

  it('keeps that getter when the object holds no instance and is not copied', () => {
    expect(interceptor.serialize(new Account(undefined), {})).toHaveProperty('hint', 'secret');
  });
});
