import superjson from 'superjson';
import { describe, expect, it } from 'vitest';

import { toSuperjson } from '../../src/adapters/superjson/index.ts';
import {
  AnyBoolean,
  Email,
  Int64,
  n,
  Nominal,
  NominalError,
  PositiveInteger,
} from '../../src/index.ts';

class Range extends Nominal(
  'sjtest.Range',
  n.object({ start: PositiveInteger, end: PositiveInteger }),
) {}

class WorkEmail extends Email.subtype('sjtest.WorkEmail', /@acme\.com$/u) {}

const json = superjson;

json.registerCustom(...toSuperjson(Email));
json.registerCustom(...toSuperjson(WorkEmail));
json.registerCustom(...toSuperjson(Int64));
json.registerCustom(...toSuperjson(AnyBoolean));
json.registerCustom(...toSuperjson(Range));

describe('toSuperjson', () => {
  it('sends instances and gets instances back', () => {
    const sent = {
      to: new Email('a@b.co'),
      work: new WorkEmail('jane@acme.com'),
      big: new Int64(9_007_199_254_740_993n),
      flag: new AnyBoolean(false),
      range: new Range({ start: 1, end: 2 }),
    };
    const text = json.stringify(sent);

    expect(JSON.parse(text)).toMatchObject({
      json: { to: 'a@b.co', big: '9007199254740993', flag: false, range: { start: 1, end: 2 } },
    });
    expect(json.parse(text)).toStrictEqual(sent);
  });

  it('keeps a subtype its own class', () => {
    const back: unknown = json.parse(json.stringify({ work: new WorkEmail('jane@acme.com') }));

    expect(back).toMatchObject({ work: expect.any(WorkEmail) as unknown });
  });

  it('names the transformer after the type', () => {
    expect(toSuperjson(Email)[1]).toBe('nominal.Email');
  });

  it('throws a NominalError for a value the type refuses', () => {
    const [transformer] = toSuperjson(Email);

    expect(() => transformer.deserialize('nope')).toThrow(NominalError);
    expect(transformer.isApplicable('a@b.co')).toBe(false);
  });
});
