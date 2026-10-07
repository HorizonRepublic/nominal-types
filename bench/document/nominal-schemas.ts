import { type } from 'arktype';
import * as v from 'valibot';
import { z } from 'zod';

import { fromArk, toArk } from '../../src/adapters/arktype/index.ts';
import { toValibot } from '../../src/adapters/valibot/index.ts';
import { toZod } from '../../src/adapters/zod/index.ts';
import {
  AnyString,
  Email,
  NonNegativeInteger,
  objectOf,
  PositiveInteger,
  schemaOf,
  Uuid,
} from '../../src/index.ts';
import { CountryCode, Postcode, Sku } from './types.ts';

export const nominalWithArkType = type({
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
      price: type({ amountMinor: schemaOf(NonNegativeInteger), currency: "'UAH' | 'EUR' | 'USD'" }),
    }).array(),
    tags: 'string[]',
  }).array(),
});

export const nominalArkAdapter = fromArk(
  type({
    exportId: toArk(Uuid),
    customers: type({
      id: toArk(Uuid),
      email: toArk(Email),
      name: 'string > 0',
      addresses: type({
        country: toArk(CountryCode),
        postcode: toArk(Postcode),
        line: 'string > 0',
      }).array(),
    }).array(),
    orders: type({
      id: toArk(Uuid),
      customerId: toArk(Uuid),
      status: "'new' | 'paid' | 'shipped'",
      items: type({
        sku: toArk(Sku),
        quantity: toArk(PositiveInteger),
        price: type({ amountMinor: toArk(NonNegativeInteger), currency: "'UAH' | 'EUR' | 'USD'" }),
      }).array(),
      tags: 'string[]',
    }).array(),
  }),
);

const nonEmpty = AnyString.subtype('bench.NonEmpty', /^./u);
const status = AnyString.subtype('bench.OrderStatus', /^(?:new|paid|shipped)$/u);
const currency = AnyString.subtype('bench.Currency', /^(?:UAH|EUR|USD)$/u);

export const nominalObjectOf = objectOf({
  exportId: Uuid,
  customers: objectOf({
    id: Uuid,
    email: Email,
    name: nonEmpty,
    addresses: objectOf({ country: CountryCode, postcode: Postcode, line: nonEmpty }).array(),
  }).array(),
  orders: objectOf({
    id: Uuid,
    customerId: Uuid,
    status,
    items: objectOf({
      sku: Sku,
      quantity: PositiveInteger,
      price: objectOf({ amountMinor: NonNegativeInteger, currency }),
    }).array(),
    tags: schemaOf(AnyString).array(),
  }).array(),
});

export const nominalZod = z.object({
  exportId: toZod(Uuid),
  customers: z.array(
    z.object({
      id: toZod(Uuid),
      email: toZod(Email),
      name: z.string().min(1),
      addresses: z.array(
        z.object({
          country: toZod(CountryCode),
          postcode: toZod(Postcode),
          line: z.string().min(1),
        }),
      ),
    }),
  ),
  orders: z.array(
    z.object({
      id: toZod(Uuid),
      customerId: toZod(Uuid),
      status: z.enum(['new', 'paid', 'shipped']),
      items: z.array(
        z.object({
          sku: toZod(Sku),
          quantity: toZod(PositiveInteger),
          price: z.object({
            amountMinor: toZod(NonNegativeInteger),
            currency: z.enum(['UAH', 'EUR', 'USD']),
          }),
        }),
      ),
      tags: z.array(z.string()),
    }),
  ),
});

export const nominalValibot = v.object({
  exportId: toValibot(Uuid),
  customers: v.array(
    v.object({
      id: toValibot(Uuid),
      email: toValibot(Email),
      name: v.pipe(v.string(), v.minLength(1)),
      addresses: v.array(
        v.object({
          country: toValibot(CountryCode),
          postcode: toValibot(Postcode),
          line: v.pipe(v.string(), v.minLength(1)),
        }),
      ),
    }),
  ),
  orders: v.array(
    v.object({
      id: toValibot(Uuid),
      customerId: toValibot(Uuid),
      status: v.picklist(['new', 'paid', 'shipped']),
      items: v.array(
        v.object({
          sku: toValibot(Sku),
          quantity: toValibot(PositiveInteger),
          price: v.object({
            amountMinor: toValibot(NonNegativeInteger),
            currency: v.picklist(['UAH', 'EUR', 'USD']),
          }),
        }),
      ),
      tags: v.array(v.string()),
    }),
  ),
});
