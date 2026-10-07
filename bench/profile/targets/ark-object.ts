import { type } from 'arktype';

import { arkOf, arkSchema } from '../../../src/adapters/arktype/index.ts';
import { Email, PositiveInteger, Uuid } from '../../../src/index.ts';
import { loop } from './loop.ts';

const schema = arkSchema(
  type({ id: arkOf(Uuid), email: arkOf(Email), quantity: arkOf(PositiveInteger) }),
);
const input = (): Record<string, unknown> => ({
  id: '3b241101-e2bb-4255-8caf-4136c566a962',
  email: 'jane@example.com',
  quantity: 3,
});

loop('arkSchema on a small object', () => schema.parse(input()));
