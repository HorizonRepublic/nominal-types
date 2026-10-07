import { buildDocument } from '../../document/data.ts';
import { documentLibraries } from '../../document/libraries.ts';
import { loop } from './loop.ts';

const document = buildDocument();
const library = documentLibraries.find(({ name }) => name === 'nominal-types + Valibot adapter');

if (library === undefined) {
  throw new Error('no Valibot setup');
}

loop('Valibot adapter on the 3 MB document', () => library.validate(document), 4);
