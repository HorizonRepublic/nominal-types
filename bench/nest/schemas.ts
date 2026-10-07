import {
  Email,
  NonNegativeInteger,
  PositiveInteger,
  schemaOf,
  Uuid,
} from '@horizon-republic/nominal-types';
import { type } from 'arktype';
import * as v from 'valibot';
import { z } from 'zod';

import { CountryCode, Postcode, Sku } from './nominal-dtos.ts';

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

export const arkType = type({
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
      price: type({ amountMinor: 'number.integer >= 0', currency: "'UAH' | 'EUR' | 'USD'" }),
    }).array(),
    tags: 'string[]',
  }).array(),
});

export const zodDocument = z.object({
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
          price: z.object({
            amountMinor: z.number().int().min(0),
            currency: z.enum(['UAH', 'EUR', 'USD']),
          }),
        }),
      ),
      tags: z.array(z.string()),
    }),
  ),
});

export const valibotDocument = v.object({
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
          price: v.object({
            amountMinor: v.pipe(v.number(), v.integer(), v.minValue(0)),
            currency: v.picklist(['UAH', 'EUR', 'USD']),
          }),
        }),
      ),
      tags: v.array(v.string()),
    }),
  ),
});
