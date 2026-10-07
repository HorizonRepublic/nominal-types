import { buildDocument } from '../../document/data.ts';
import { nominalArkAdapter } from '../../document/nominal-schemas.ts';
import { loop } from './loop.ts';

const document = buildDocument();

loop('fromArk on the 3 MB document', () => nominalArkAdapter.parse(document), 4);
