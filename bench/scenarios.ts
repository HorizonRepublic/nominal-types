import {
  brokenEmailAt,
  brokenPositiveIntegerAt,
  brokenSkuAt,
  brokenUuidAt,
  emailAt,
  flat,
  pool,
  poolSize,
  positiveIntegerAt,
  skuAt,
  textPool,
  uuidAt,
} from './inputs.ts';
import type { Check, Library } from './libraries.ts';

/**
 * One row of the comparison: which check of a library it runs, on which inputs, and whether the
 * library should accept them.
 */
export interface Scenario {
  readonly title: string;
  readonly pick: (library: Library) => Check | undefined;
  readonly inputs: readonly unknown[];
  readonly valid: boolean;
}

const listLength = 1000;
const listIds = Array.from({ length: listLength + poolSize }, (_, index) =>
  flat(uuidAt(index + 100_000)),
);

export const scenarios: readonly Scenario[] = [
  {
    title: 'the same pattern, valid',
    pick: (library) => library.sku,
    inputs: textPool(skuAt),
    valid: true,
  },
  {
    title: 'the same pattern, invalid',
    pick: (library) => library.sku,
    inputs: textPool(brokenSkuAt),
    valid: false,
  },
  { title: 'UUID, valid', pick: (library) => library.uuid, inputs: textPool(uuidAt), valid: true },
  {
    title: 'UUID, invalid',
    pick: (library) => library.uuid,
    inputs: textPool(brokenUuidAt),
    valid: false,
  },
  {
    title: 'email, valid',
    pick: (library) => library.email,
    inputs: textPool(emailAt),
    valid: true,
  },
  {
    title: 'email, invalid',
    pick: (library) => library.email,
    inputs: textPool(brokenEmailAt),
    valid: false,
  },
  {
    title: 'positive integer, valid',
    pick: (library) => library.positiveInteger,
    inputs: pool(positiveIntegerAt),
    valid: true,
  },
  {
    title: 'positive integer, invalid',
    pick: (library) => library.positiveInteger,
    inputs: pool(brokenPositiveIntegerAt),
    valid: false,
  },
  {
    title: '1000 UUIDs in an array',
    pick: (library) => library.uuidList,
    inputs: pool((index) => listIds.slice(index, index + listLength)),
    valid: true,
  },
];
