import { buildDocument } from '../../document/data.ts';
import { nominalArkAdapter } from '../../document/libraries.ts';
import { loop } from './loop.ts';

const document = buildDocument();

loop('arkSchema on the 3 MB document', () => nominalArkAdapter.parse(document), 4);
