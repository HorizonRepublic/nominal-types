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
 * Options for `fastifyNominal`.
 */
export interface FastifyNominalOptions extends NominalValidatorOptions {
  /**
   * The JSON Schema dialect the routes show for nominal schemas, which `@fastify/swagger` reads.
   * `'draft-07'` by default; `'openapi-3.0'` for a Swagger document of OpenAPI 3.0.
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

// Fastify keeps the compilers it builds by default only on its schema controller, under a symbol
// it doesn't export; they are the ones a schema that is not nominal goes to.
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
 * const app = Fastify().withTypeProvider<NominalTypeProvider>();
 *
 * await app.register(fastifyNominal);
 * app.post('/orders', { schema: { body: CreateOrder, response: { 201: Order } } }, handler);
 * ```
 */
export const fastifyNominal: FastifyPluginCallback<FastifyNominalOptions> = Object.assign(
  register,
  {
    [Symbol.for('skip-override')]: true,
    [Symbol.for('fastify.display-name')]: 'fastifyNominal',
    [Symbol.for('plugin-meta')]: { name: 'fastifyNominal', fastify: '5.x' },
  },
);
