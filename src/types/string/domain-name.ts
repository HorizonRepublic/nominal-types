import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { hasTopLevelText, topLevelPattern } from './dns-name.ts';
import { Hostname } from './hostname.ts';

const DomainNameBase: SubtypeOf<typeof Hostname, 'nominal.DomainName'> = Hostname.subtype(
  'nominal.DomainName',
  stringOnly(
    satisfying(hasTopLevelText, 'a domain name with a top-level domain', {
      type: 'string',
      pattern: topLevelPattern.source,
      examples: ['example.com'],
    }),
  ),
);

/**
 * A host name with a top-level domain, such as `example.com`: two labels or more, the last one of
 * letters or an `xn--` label.
 *
 * @remarks
 * RFC 1035 §2.3.4 gives the syntax and RFC 3696 §2 rules out an all-digit top-level domain; this
 * type goes further and takes only letters there, as every delegated top-level domain is spelled.
 * `localhost` is a `Hostname` and not a `DomainName`. The members are those of `Hostname`.
 *
 * @example
 * ```ts
 * new DomainName('api.example.com').isSubdomainOf(new DomainName('example.com')); // true
 * ```
 */
export class DomainName extends DomainNameBase {
  /**
   * The same name in lowercase, the form DNS compares names in.
   */
  public override canonical(): this {
    return sameType(this, this.value.toLowerCase());
  }
}
