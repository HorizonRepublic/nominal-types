import 'temporal-polyfill/global';
import { describe, expect, it } from 'vitest';

import type { AnyNominalType, IssueDetails, NominalIssue } from '../../src/index.ts';
import { Bic, E164PhoneNumber, Iban, Jwt } from '../../src/index.ts';
import { Duration, TimeZoneId, ZonedDateTime } from '../../src/temporal/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { issuesOf, valueOf } from '../support/results.ts';

resetConfigurationAfterEach();

const refused: ReadonlyArray<[string, AnyNominalType, string, string]> = [
  ['Iban', Iban, 'DE89 3704 0044 0532 0130 00', 'invalid'],
  ['Iban', Iban, 'DE00370400440532013000', 'invalid'],
  ['Bic', Bic, 'deutdeff', 'invalid'],
  ['E164PhoneNumber', E164PhoneNumber, '+1 415 555 2671', 'invalid'],
  ['Jwt', Jwt, 'nope', 'invalid'],
  ['TimeZoneId', TimeZoneId, 'Mars/Olympus', 'invalid'],
  ['ZonedDateTime', ZonedDateTime, '2026-10-08', 'invalid'],
  ['Duration', Duration, 'P1Y2', 'invalid'],
];

const accepted: ReadonlyArray<[string, AnyNominalType, string]> = [
  ['Iban', Iban, 'DE89370400440532013000'],
  ['Bic', Bic, 'DEUTDEFF'],
  ['E164PhoneNumber', E164PhoneNumber, '+14155552671'],
  ['Jwt', Jwt, 'eyJhbGciOiJIUzI1NiJ9.e30.c2ln'],
  ['TimeZoneId', TimeZoneId, 'Europe/Berlin'],
];

describe('the types of the latest releases under n.configure()', () => {
  it.each(refused)('give %s a code for %j', (_, Type, value, code) => {
    const [issue]: readonly NominalIssue[] = configured({ codes: true }, () =>
      issuesOf(Type.parse(value)),
    );

    expect(issue?.code).toBe(code);
  });

  it.each(refused)(
    'leave the value out of the message of %s with values: hide',
    (_, Type, value) => {
      const [issue] = configured({ values: 'hide' }, () => issuesOf(Type.parse(value)));

      expect(issue?.message).not.toContain('(was');
    },
  );

  it.each(refused)('give %s for %j a description its English message says', (_, Type, value) => {
    const seen: IssueDetails[] = [];

    configured({ messages: (issue) => void seen.push(issue) }, () => Type.parse(value));

    expect(seen).toHaveLength(1);
    expect(seen[0]?.message).toContain(`must be ${String(seen[0]?.description)}`);
  });

  it.each(accepted)('trim the input of %s with trimStrings', (_, Type, value) => {
    expect(Type.accepts(` ${value}\n`)).toBe(false);
    const parsed = configured({ normalize: { trimStrings: true } }, () =>
      Type.parse(` ${value}\n`),
    );

    expect(valueOf(parsed)).toHaveProperty('value', value);
  });
});
