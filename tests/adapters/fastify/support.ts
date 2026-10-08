import Fastify from 'fastify';
import type {
  FastifyBaseLogger,
  FastifyInstance,
  InjectOptions,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from 'fastify';

import { fastifyNominal } from '../../../src/adapters/fastify/index.ts';
import type {
  FastifyNominalOptions,
  NominalTypeProvider,
} from '../../../src/adapters/fastify/index.ts';
import { AnyBoolean, AnyString, Email, n, PositiveInteger, Uuid } from '../../../src/index.ts';

export const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export const CreateOrder = n.object({
  customer: Email,
  sku: Sku,
  quantity: PositiveInteger,
  note: n.of(AnyString).optional(),
});

export const Order = n.object({ id: Uuid, quantity: PositiveInteger, paid: AnyBoolean });

export type NominalApp = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  NominalTypeProvider
>;

export const typedApp = (app: FastifyInstance = Fastify()): NominalApp =>
  app.withTypeProvider<NominalTypeProvider>();

export const nominalApp = async (options: FastifyNominalOptions = {}): Promise<NominalApp> => {
  const app = typedApp();

  await app.register(fastifyNominal, options);

  return app;
};

export interface Answer {
  readonly status: number;
  readonly body: unknown;
}

export const answer = async (app: FastifyInstance, request: InjectOptions): Promise<Answer> => {
  const response = await app.inject(request);
  const text = response.body;

  return { status: response.statusCode, body: text === '' ? undefined : JSON.parse(text) };
};

export const rejection = (message: string): Record<string, unknown> => ({
  statusCode: 400,
  code: 'FST_ERR_VALIDATION',
  error: 'Bad Request',
  message,
});
