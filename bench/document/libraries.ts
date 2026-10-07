import 'reflect-metadata';
import { type } from 'arktype';
import * as v from 'valibot';
import { z } from 'zod';

import { Email, NonNegativeInteger, PositiveInteger, schemaOf, Uuid } from '../../src/index.ts';
import * as typia from '../typia/dist/validators.js';
import { nominalWithClassValidator, plainClassValidator } from './class-validator-dtos.ts';
import { CountryCode, Postcode, Sku } from './types.ts';

/**
 * How one library validates the whole document, and how to tell whether it accepted it.
 */
export interface DocumentLibrary {
  readonly name: string;
  readonly validate: (input: unknown) => unknown;
  readonly accepted: (result: unknown) => boolean;
}

const field = (result: unknown, key: string): unknown =>
  typeof result === 'object' && result !== null ? Reflect.get(result, key) : undefined;

const nominalWithArkType = type({
  exportId: schemaOf(Uuid),
  customers: type({
    id: schemaOf(Uuid),
    email: schemaOf(Email),
    name: 'string > 0',
    addresses: type({
      country: schemaOf(CountryCode),
      postcode: schemaOf(Postcode),
      line: 'string > 0',
    }).array(),
  }).array(),
  orders: type({
    id: schemaOf(Uuid),
    customerId: schemaOf(Uuid),
    status: "'new' | 'paid' | 'shipped'",
    items: type({
      sku: schemaOf(Sku),
      quantity: schemaOf(PositiveInteger),
      priceMinor: schemaOf(NonNegativeInteger),
    }).array(),
    tags: 'string[]',
  }).array(),
});

const plainArkType = type({
  exportId: 'string.uuid',
  customers: type({
    id: 'string.uuid',
    email: 'string.email',
    name: 'string > 0',
    addresses: type({ country: /^[A-Z]{2}$/u, postcode: /^\d{5}$/u, line: 'string > 0' }).array(),
  }).array(),
  orders: type({
    id: 'string.uuid',
    customerId: 'string.uuid',
    status: "'new' | 'paid' | 'shipped'",
    items: type({
      sku: /^SKU-\d{4}$/u,
      quantity: 'number.integer >= 1',
      priceMinor: 'number.integer >= 0',
    }).array(),
    tags: 'string[]',
  }).array(),
});

const zodDocument = z.object({
  exportId: z.uuid(),
  customers: z.array(
    z.object({
      id: z.uuid(),
      email: z.email(),
      name: z.string().min(1),
      addresses: z.array(
        z.object({
          country: z.string().regex(/^[A-Z]{2}$/u),
          postcode: z.string().regex(/^\d{5}$/u),
          line: z.string().min(1),
        }),
      ),
    }),
  ),
  orders: z.array(
    z.object({
      id: z.uuid(),
      customerId: z.uuid(),
      status: z.enum(['new', 'paid', 'shipped']),
      items: z.array(
        z.object({
          sku: z.string().regex(/^SKU-\d{4}$/u),
          quantity: z.number().int().min(1),
          priceMinor: z.number().int().min(0),
        }),
      ),
      tags: z.array(z.string()),
    }),
  ),
});

const valibotDocument = v.object({
  exportId: v.pipe(v.string(), v.uuid()),
  customers: v.array(
    v.object({
      id: v.pipe(v.string(), v.uuid()),
      email: v.pipe(v.string(), v.email()),
      name: v.pipe(v.string(), v.minLength(1)),
      addresses: v.array(
        v.object({
          country: v.pipe(v.string(), v.regex(/^[A-Z]{2}$/u)),
          postcode: v.pipe(v.string(), v.regex(/^\d{5}$/u)),
          line: v.pipe(v.string(), v.minLength(1)),
        }),
      ),
    }),
  ),
  orders: v.array(
    v.object({
      id: v.pipe(v.string(), v.uuid()),
      customerId: v.pipe(v.string(), v.uuid()),
      status: v.picklist(['new', 'paid', 'shipped']),
      items: v.array(
        v.object({
          sku: v.pipe(v.string(), v.regex(/^SKU-\d{4}$/u)),
          quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
          priceMinor: v.pipe(v.number(), v.integer(), v.minValue(0)),
        }),
      ),
      tags: v.array(v.string()),
    }),
  ),
});

const classValidatorAccepted = (result: unknown): boolean =>
  Array.isArray(result) && result.length === 0;

export const documentLibraries: readonly DocumentLibrary[] = [
  {
    name: 'nominal-types + ArkType',
    validate: nominalWithArkType,
    accepted: (result) => !(result instanceof type.errors),
  },
  {
    name: 'nominal-types + class-validator',
    validate: nominalWithClassValidator,
    accepted: classValidatorAccepted,
  },
  {
    name: 'typia',
    validate: typia.validateDocument,
    accepted: (result) => field(result, 'success') === true,
  },
  {
    name: 'arktype',
    validate: plainArkType,
    accepted: (result) => !(result instanceof type.errors),
  },
  {
    name: 'zod',
    validate: (input) => zodDocument.safeParse(input),
    accepted: (result) => field(result, 'success') === true,
  },
  {
    name: 'valibot',
    validate: (input) => v.safeParse(valibotDocument, input),
    accepted: (result) => field(result, 'success') === true,
  },
  { name: 'class-validator', validate: plainClassValidator, accepted: classValidatorAccepted },
];
