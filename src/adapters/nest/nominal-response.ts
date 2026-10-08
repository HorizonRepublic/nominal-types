import { UseInterceptors } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';

/**
 * What {@link NominalResponse} writes a response with: a schema built by `n.of()` or
 * `n.object()`, or a nominal type.
 *
 * @typeParam Value - The value a route returns.
 */
export interface NominalResponseSchema<Value> {
  /**
   * Writes a value as JSON text.
   *
   * @param value - The value a route returned.
   * @returns The JSON text of the response body.
   */
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
 * The interceptor behind {@link NominalResponse}: it writes what a route returns with the
 * schema's `stringify()` and sends the text as `application/json`, on Express and on Fastify.
 *
 * @remarks
 * Use it where a decorator doesn't fit, such as `@UseInterceptors()` on a whole controller whose
 * routes all return one schema. Outside HTTP, such as in a microservice, the value passes as it is.
 *
 * @typeParam Value - The value the routes return.
 *
 * @example
 * ```ts
 * import { Controller, Get, UseInterceptors } from '@nestjs/common';
 * import { Email, n, Uuid } from '@horizon-republic/nominal-types';
 * import type { ValueOf } from '@horizon-republic/nominal-types';
 * import { NominalResponseInterceptor } from '@horizon-republic/nominal-types/adapters/nest';
 *
 * const Order = n.object({ id: Uuid, customer: Email });
 *
 * declare const latestOrder: () => ValueOf<typeof Order>;
 *
 * @Controller('orders')
 * @UseInterceptors(new NominalResponseInterceptor(Order))
 * export class OrdersController {
 *   @Get('latest')
 *   public latest(): ValueOf<typeof Order> {
 *     return latestOrder();
 *   }
 * }
 * ```
 *
 * @see {@link NominalResponse}
 */
export class NominalResponseInterceptor<Value> implements NestInterceptor<Value, unknown> {
  readonly #schema: NominalResponseSchema<Value>;

  /**
   * Creates the interceptor for one schema.
   *
   * @param schema - The schema or nominal type that writes the response.
   */
  public constructor(schema: NominalResponseSchema<Value>) {
    this.#schema = schema;
  }

  /**
   * Writes the value a route returns as JSON text. Nest calls it for you.
   *
   * @param context - The request the route runs for.
   * @param next - The route handler.
   * @returns The response text, or the value as it is outside HTTP.
   */
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
 * Writes a route's response with a schema's generated `stringify()`, for routes that return one
 * known shape.
 *
 * @remarks
 * The route has to return a value the schema gave, or one of the same shape; the body is what
 * `JSON.stringify(n.plain(value))` would write, with only the fields the schema declares. It works
 * on Express and on Fastify, next to `NominalSerializerInterceptor`, which leaves the text
 * alone. It is several times faster than Nest's `JSON.stringify()` of the same instances.
 *
 * @typeParam Value - The value the route returns.
 * @param schema - The schema or nominal type that writes the response.
 * @returns A decorator for a route or a whole controller.
 *
 * @example
 * ```ts
 * import { Controller, Get, Param } from '@nestjs/common';
 * import { Email, n, Uuid } from '@horizon-republic/nominal-types';
 * import type { ValueOf } from '@horizon-republic/nominal-types';
 * import { NominalResponse } from '@horizon-republic/nominal-types/adapters/nest';
 *
 * const Order = n.object({ id: Uuid, customer: Email });
 *
 * declare const findOrder: (id: Uuid) => ValueOf<typeof Order>;
 *
 * @Controller('orders')
 * export class OrdersController {
 *   @Get(':id')
 *   @NominalResponse(Order)
 *   public find(@Param('id') id: Uuid): ValueOf<typeof Order> {
 *     return findOrder(id);
 *   }
 * }
 * ```
 *
 * @see {@link NominalResponseInterceptor}
 */
export const NominalResponse = <Value>(
  schema: NominalResponseSchema<Value>,
): MethodDecorator & ClassDecorator => UseInterceptors(new NominalResponseInterceptor(schema));
