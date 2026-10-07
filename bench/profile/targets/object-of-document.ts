import { buildDocument } from '../../document/data.ts';
import { nominalObjectOf } from '../../document/libraries.ts';
import { loop } from './loop.ts';

const document = buildDocument();

loop('objectOf() on the 3 MB document', () => nominalObjectOf.parse(document), 4);
