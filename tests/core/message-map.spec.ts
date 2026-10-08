import { describe, expect, it, vi } from 'vitest';

import type {
  Configuration,
  IssueDetails,
  MessageFunction,
  NominalIssue,
} from '../../src/index.ts';
import { AnyString, Email, n, PositiveInteger, Uuid } from '../../src/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { issuesOf } from '../support/results.ts';

resetConfigurationAfterEach();

const messagesOf = (issues: readonly NominalIssue[]): readonly string[] =>
  issues.map(({ message }) => message);

const Sku = AnyString.subtype('message-map.Sku', /^[A-Z]{3}-\d{4}$/u, {});
const Order = n.object({ id: Uuid, customer: Email, quantity: PositiveInteger });

describe('messages: a map by issue code', () => {
  const german: Configuration['messages'] = {
    required: 'ist erforderlich',
    pattern: ({ value }) => (value === undefined ? 'hat das falsche Format' : `ungültig: ${value}`),
  };

  it('writes the message of each code it names and keeps English for the rest', () => {
    configured({ messages: german }, () => {
      expect(messagesOf(issuesOf(Order.parse({})))).toStrictEqual([
        'ist erforderlich',
        'ist erforderlich',
        'ist erforderlich',
      ]);
      expect(messagesOf(issuesOf(Uuid.parse('nope')))).toStrictEqual(['ungültig: "nope"']);
      expect(messagesOf(issuesOf(n.object({}).parse(1)))).toStrictEqual([
        'must be an object (was 1)',
      ]);
    });
  });

  it('keeps English where a function in the map returns undefined', () => {
    const keep = vi.fn<MessageFunction>();

    configured({ messages: { pattern: keep } }, () => {
      expect(messagesOf(issuesOf(Uuid.parse('nope')))).toStrictEqual([
        'must be a UUID (was "nope")',
      ]);
    });

    expect(keep).toHaveBeenCalledTimes(1);
  });

  it('is written again with the value hidden by n.hideValues()', () => {
    configured({ messages: german }, () => {
      expect(messagesOf(n.hideValues(issuesOf(Uuid.parse('nope'))))).toStrictEqual([
        'ungültig: a string of 4 characters',
      ]);
    });
  });

  it('is returned by the next call as it was given, and puts back with it', () => {
    const previous = n.configure({ messages: german });

    expect(n.configure(previous).messages).toStrictEqual(german);
    expect(messagesOf(issuesOf(Order.parse({})))[0]).toBe('is required');
  });

  it('is copied, so changing the map afterwards changes nothing', () => {
    const map: Record<string, string> = { required: 'ist erforderlich' };

    configured({ messages: map }, () => {
      map['required'] = 'fehlt';

      expect(messagesOf(issuesOf(Order.parse({})))[0]).toBe('ist erforderlich');
    });
  });
});

describe('messages: the path of an issue', () => {
  const Address = n.object({ city: Sku });
  const Customer = n.object({ address: Address, tags: n.of(Sku).array() });

  it('gives the whole path of a nested field and of an item', () => {
    const paths: unknown[] = [];

    configured(
      {
        messages: (issue) => {
          paths.push(issue.path);

          return `${String(issue.path?.join('.'))}: ${issue.code}`;
        },
      },
      () => {
        expect(
          issuesOf(Customer.parse({ address: { city: 'x' }, tags: ['ABC-0001', 'y'] })),
        ).toStrictEqual([
          { message: 'address.city: pattern', path: ['address', 'city'] },
          { message: 'tags.1: pattern', path: ['tags', 1] },
        ]);
      },
    );

    expect(paths.at(-1)).toStrictEqual(['tags', 1]);
  });

  it('gives no path to an issue of the whole value', () => {
    const messages = vi.fn<(issue: IssueDetails) => string | undefined>();

    configured({ messages }, () => Sku.parse('x'));

    expect(messages.mock.calls[0]?.[0]).not.toHaveProperty('path');
  });
});
