import {
  Email,
  Int8,
  NonNegativeInteger,
  PositiveInteger,
  Uint8,
  Uuid,
} from '../../../src/index.ts';
import { loop } from './loop.ts';

loop('parse() of six types in turn', () => {
  Email.parse('jane@example.com');
  Uuid.parse('3b241101-e2bb-4255-8caf-4136c566a962');
  PositiveInteger.parse(3);
  NonNegativeInteger.parse(0);
  Uint8.parse(200);
  Int8.parse(-5);
});
