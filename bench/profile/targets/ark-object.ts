import { type } from 'arktype';

import { toArk, fromArk } from '../../../src/adapters/arktype/index.ts';
import { Email, PositiveInteger, Uuid } from '../../../src/index.ts';
import { loop } from './loop.ts';

const schema = fromArk(
  type({ id: toArk(Uuid), email: toArk(Email), quantity: toArk(PositiveInteger) }),
);
const input = (): Record<string, unknown> => ({
  id: '3b241101-e2bb-4255-8caf-4136c566a962',
  email: 'jane@example.com',
  quantity: 3,
});

loop('fromArk on a small object', () => schema.parse(input()));
