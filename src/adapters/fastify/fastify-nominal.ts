import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import { serializerCompilerWith, validatorCompilerWith } from './compilers.ts';
import type {
  NominalSerializerCompiler,
  NominalValidatorCompiler,
  NominalValidatorOptions,
} from './compilers.ts';
import { standInMaker } from './stand-ins.ts';
import type { FastifyJsonTarget } from './stand-ins.ts';

/**
 * Options for {@link fastifyNominal}.
 */
export interface FastifyNominalOptions extends NominalValidatorOptions {
  /**
   * The JSON Schema dialect the routes show for nominal schemas, which `@fastify/swagger` reads.
   * Use `'openapi-3.0'` for a Swagger document of OpenAPI 3.0.
   *
   * @defaultValue `'draft-07'`
   */
  readonly jsonSchemaTarget?: FastifyJsonTarget;
}

type ValidatorBuilder = (schemas: unknown, options: unknown) => NominalValidatorCompiler;
type SerializerBuilder = (schemas: unknown, options: unknown) => NominalSerializerCompiler;

interface SchemaController {
  getValidatorBuilder(): ValidatorBuilder;
  getSerializerBuilder(): SerializerBuilder;
  getValidatorCompiler(): NominalValidatorCompiler | undefined;
  getSerializerCompiler(): NominalSerializerCompiler | undefined;
}

const isController = (value: unknown): value is SchemaController =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'getValidatorBuilder') === 'function' &&
  typeof Reflect.get(value, 'getSerializerBuilder') === 'function';

/**
 * The schema controller of a Fastify instance, with the compilers Fastify builds by default.
 *
 * @remarks
 * Fastify keeps them only on its schema controller, under a symbol it doesn't export; they are the
 * ones a schema that is not nominal goes to.
 *
 * @throws {@link TypeError} when the Fastify version keeps no schema controller where Fastify 5
 * does.
 *
 * @internal
 */
const controllerOf = (instance: FastifyInstance): SchemaController => {
  for (let owner: object | null = instance; owner !== null; owner = Reflect.getPrototypeOf(owner)) {
    const key = Object.getOwnPropertySymbols(owner).find(
      (symbol) => symbol.description === 'fastify.schemaController',
    );
    const controller: unknown = key === undefined ? undefined : Reflect.get(instance, key);

    if (isController(controller)) {
      return controller;
    }
  }

  throw new TypeError('fastifyNominal: this version of Fastify is not supported; use Fastify 5');
};

const once = <Value>(make: () => Value): (() => Value) => {
  let made: { readonly value: Value } | undefined;

  return () => (made ??= { value: make() }).value;
};

/**
 * Sets up the nominal compilers next to the ones Fastify builds by default.
 *
 * @throws {@link TypeError} when the Fastify version keeps no schema controller where Fastify 5
 * does.
 *
 * @internal
 */
const register: FastifyPluginCallback<FastifyNominalOptions> = (instance, options, done) => {
  const controller = controllerOf(instance);
  const buildValidator = controller.getValidatorBuilder();
  const buildSerializer = controller.getSerializerBuilder();
  const validator = controller.getValidatorCompiler();
  const serializer = controller.getSerializerCompiler();
  const compilersFactory = {
    buildValidator: (schemas: unknown, ajv: unknown) =>
      validatorCompilerWith(
        options,
        once(() => buildValidator(schemas, ajv)),
      ),
    buildSerializer: (schemas: unknown, serializerOptions: unknown) =>
      serializerCompilerWith(once(() => buildSerializer(schemas, serializerOptions))),
  };

  // Fastify types these factories as returning the compile function of Ajv, not the compiler of
  // a route they return, so the method is called untyped.
  const setController: unknown = Reflect.get(instance, 'setSchemaController');

  if (typeof setController === 'function') {
    Reflect.apply(setController, instance, [{ compilersFactory }]);
  }

  // A compiler set before the plugin is kept by Fastify instead of being built again.
  if (validator !== undefined) {
    instance.setValidatorCompiler(validatorCompilerWith(options, () => validator));
  }

  if (serializer !== undefined) {
    instance.setSerializerCompiler(serializerCompilerWith(() => serializer));
  }

  const standIns = standInMaker(options.jsonSchemaTarget ?? 'draft-07');

  instance.addHook('onRoute', (route) => {
    if (route.schema !== undefined) {
      route.schema = standIns(route.schema);
    }
  });

  done();
};

/**
 * A Fastify plugin that checks requests and writes responses with nominal types and schemas
 * given in a route's `schema`, so the handler gets instances, and that leaves every other JSON
 * Schema to Fastify.
 *
 * @remarks
 * Register it before the routes, at the top or in the plugin whose routes use it. A rejected
 * request gets Fastify's status 400 with the schema's messages. A response is written with the
 * schema's `stringify()`. The routes show each nominal schema as JSON Schema, which
 * `@fastify/swagger` reads. Pair it with `NominalTypeProvider` for the types.
 *
 * @example
 * ```ts
 * import Fastify from 'fastify';
 * import { Email, n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
 * import type { ValueOf } from '@horizon-republic/nominal-types';
 * import { fastifyNominal } from '@horizon-republic/nominal-types/adapters/fastify';
 * import type { NominalTypeProvider } from '@horizon-republic/nominal-types/adapters/fastify';
 *
 * const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });
 * const Order = n.object({ id: Uuid, customer: Email, quantity: PositiveInteger });
 *
 * declare const saveOrder: (order: ValueOf<typeof CreateOrder>) => Promise<ValueOf<typeof Order>>;
 *
 * const app = Fastify().withTypeProvider<NominalTypeProvider>();
 *
 * await app.register(fastifyNominal);
 *
 * app.post(
 *   '/orders',
 *   { schema: { body: CreateOrder, response: { 201: Order } } },
 *   async (request) => saveOrder(request.body),
 * );
 * ```
 *
 * @see {@link NominalValidatorOptions}
 */
export const fastifyNominal: FastifyPluginCallback<FastifyNominalOptions> = Object.assign(
  register,
  {
    [Symbol.for('skip-override')]: true,
    [Symbol.for('fastify.display-name')]: 'fastifyNominal',
    [Symbol.for('plugin-meta')]: { name: 'fastifyNominal', fastify: '5.x' },
  },
);
