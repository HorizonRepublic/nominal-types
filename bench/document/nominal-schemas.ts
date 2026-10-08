import { type } from 'arktype';
import * as v from 'valibot';
import { z } from 'zod';

import { fromArk, toArk } from '../../src/adapters/arktype/index.ts';
import { toValibot } from '../../src/adapters/valibot/index.ts';
import { toZod } from '../../src/adapters/zod/index.ts';
import { AnyString, Email, n, NonNegativeInteger, PositiveInteger, Uuid } from '../../src/index.ts';
import { CountryCode, Postcode, Sku } from './types.ts';

export const nominalWithArkType = type({
  exportId: n.of(Uuid),
  customers: type({
    id: n.of(Uuid),
    email: n.of(Email),
    name: 'string > 0',
    addresses: type({
      country: n.of(CountryCode),
      postcode: n.of(Postcode),
      line: 'string > 0',
    }).array(),
  }).array(),
  orders: type({
    id: n.of(Uuid),
    customerId: n.of(Uuid),
    status: "'new' | 'paid' | 'shipped'",
    items: type({
      sku: n.of(Sku),
      quantity: n.of(PositiveInteger),
      price: type({ amountMinor: n.of(NonNegativeInteger), currency: "'UAH' | 'EUR' | 'USD'" }),
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

export const nominalObjectOf = n.object({
  exportId: Uuid,
  customers: n
    .object({
      id: Uuid,
      email: Email,
      name: nonEmpty,
      addresses: n.object({ country: CountryCode, postcode: Postcode, line: nonEmpty }).array(),
    })
    .array(),
  orders: n
    .object({
      id: Uuid,
      customerId: Uuid,
      status,
      items: n
        .object({
          sku: Sku,
          quantity: PositiveInteger,
          price: n.object({ amountMinor: NonNegativeInteger, currency }),
        })
        .array(),
      tags: n.of(AnyString).array(),
    })
    .array(),
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
