import { Email, PositiveInteger, Uuid } from '../../../src/index.ts';
import { loop } from './loop.ts';

loop('Email.parse', () => Email.parse('jane@example.com'), 1);
loop('Uuid.parse', () => Uuid.parse('3b241101-e2bb-4255-8caf-4136c566a962'), 1);
loop('new PositiveInteger', () => new PositiveInteger(42), 1);
