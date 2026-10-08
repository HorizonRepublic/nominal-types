import { type } from 'arktype';

import { fromArk, toArk } from '../../src/adapters/arktype/index.ts';
import { Email, n, PositiveInteger, Uuid } from '../../src/index.ts';
import { emailAt, flat, pool, positiveIntegerAt, uuidAt } from '../inputs.ts';
import type { Case } from './case.ts';

const objects = pool((index) => ({
  id: flat(uuidAt(index)),
  email: flat(emailAt(index)),
  quantity: positiveIntegerAt(index),
}));

const setups: Readonly<Record<string, () => Case>> = {
  'ArkType alone, plain values': () => {
    const plain = type({
      id: 'string.uuid',
      email: 'string.email',
      quantity: 'number.integer > 0',
    });

    return ['ArkType alone, plain values', objects, (input) => plain(input)];
  },
  'the ArkType adapter, with instances': () => {
    const adapted = fromArk(
      type({ id: toArk(Uuid), email: toArk(Email), quantity: toArk(PositiveInteger) }),
    );

    return ['the ArkType adapter, with instances', objects, (input) => adapted.parse(input)];
  },
  '`n.of()` fields inside ArkType': () => {
    const inside = type({ id: n.of(Uuid), email: n.of(Email), quantity: n.of(PositiveInteger) });

    return ['`n.of()` fields inside ArkType', objects, (input) => inside(input)];
  },
};

/**
 * The names of the ways to check one small object with ArkType, each timed in a process of its own.
 */
export const arkObjectSetups: readonly string[] = Object.keys(setups);

/**
 * The case of one way to check the object.
 */
export const arkObjectCase = (name: string): Case => {
  const setup = setups[name];

  if (setup === undefined) {
    throw new Error(`unknown ArkType setup ${name}`);
  }

  return setup();
};
