import { UseInterceptors } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';

/**
 * What `NominalResponse` writes a response with: a schema built by `n.of()` or `n.object()`, or a
 * nominal type.
 */
export interface NominalResponseSchema<Value> {
  stringify(value: Value): string;
}

const contentType = 'application/json; charset=utf-8';

const setJsonType = (response: unknown): void => {
  const header: unknown =
    typeof response === 'object' && response !== null ? Reflect.get(response, 'header') : undefined;

  if (typeof header === 'function') {
    Reflect.apply(header, response, ['content-type', contentType]);
  }
};

/**
 * The interceptor behind `NominalResponse`: it writes what a route returns with the schema's
 * `stringify()` and sends the text as `application/json`, on Express and on Fastify.
 *
 * @remarks
 * Use it where a decorator doesn't fit, such as `@UseInterceptors()` on a whole controller whose
 * routes all return one schema. Outside HTTP, such as in a microservice, the value passes as it is.
 */
export class NominalResponseInterceptor<Value> implements NestInterceptor<Value, unknown> {
  readonly #schema: NominalResponseSchema<Value>;

  public constructor(schema: NominalResponseSchema<Value>) {
    this.#schema = schema;
  }

  public intercept(context: ExecutionContext, next: CallHandler<Value>): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const response: unknown = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((value) => {
        const text = this.#schema.stringify(value);

        setJsonType(response);

        return text;
      }),
    );
  }
}

/**
 * Writes a route's response with a schema's generated `stringify()`, several times faster than
 * Nest's `JSON.stringify()` of the same instances, for routes that return one known shape.
 *
 * @remarks
 * The route has to return a value the schema gave, or one of the same shape; the body is what
 * `JSON.stringify(n.plain(value))` would write, with only the fields the schema declares. It works
 * on Express and on Fastify, next to `NominalSerializerInterceptor`, which leaves the text alone.
 *
 * @example
 * ```ts
 * @Get(':id')
 * @NominalResponse(Order)
 * public find(@Param('id') id: Uuid): ValueOf<typeof Order> {
 *   return this.orders.find(id);
 * }
 * ```
 */
export const NominalResponse = <Value>(
  schema: NominalResponseSchema<Value>,
): MethodDecorator & ClassDecorator => UseInterceptors(new NominalResponseInterceptor(schema));
