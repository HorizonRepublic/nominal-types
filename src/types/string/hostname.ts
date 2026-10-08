import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { inOneLine } from '../../core/same-value.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import { digitsLastPattern, hostnamePattern, isHostnameText, uLabelOf } from './dns-name.ts';

const HostnameBase: SubtypeOf<typeof AnyString, 'nominal.Hostname'> = AnyString.subtype(
  'nominal.Hostname',
  stringOnly(
    satisfying(isHostnameText, 'a host name', {
      type: 'string',
      format: 'hostname',
      pattern: hostnamePattern.source,
      minLength: 1,
      maxLength: 253,
      not: { pattern: digitsLastPattern.source },
      examples: ['api.example.com'],
    }),
  ),
);

/**
 * A host name as RFC 1123 §2.1 defines it, such as `localhost` or `api.example.com`.
 *
 * @remarks
 * Labels of letters, digits and inner hyphens, 63 characters each and 253 in all, as RFC 1035
 * §2.3.4 limits them. A label may start with a digit, but the last one is never all digits, so an
 * IPv4 address is never a host name. The trailing dot of a fully qualified name is refused, and so
 * is a label with hyphens in its third and fourth places unless it is an `xn--` label that decodes
 * to Unicode (RFC 5891 §4.2.3.1, §5.4). Unicode text passes once converted to `xn--` labels.
 *
 * @example
 * ```ts
 * const host = new Hostname('API.Example.com');
 * host.labels; // ['API', 'Example', 'com']
 * host.canonical().value; // 'api.example.com'
 * ```
 */
export class Hostname extends HostnameBase {
  /**
   * The labels between the dots, from the leftmost.
   */
  public get labels(): string[] {
    return this.value.split('.');
  }

  /**
   * The same name in lowercase, the form DNS compares names in.
   */
  public canonical(): this {
    return sameType(this, this.value.toLowerCase());
  }

  /**
   * The name with each `xn--` label decoded to Unicode, for showing to people.
   *
   * @remarks
   * The result is display text, not a host name, so it comes back as a plain string.
   */
  public toUnicode(): string {
    return this.labels
      .map((label) => (label.toLowerCase().startsWith('xn--') ? (uLabelOf(label) ?? label) : label))
      .join('.');
  }

  /**
   * Whether this name is the other one or lies below it, ignoring case, as RFC 1034 §3.1 defines a
   * subdomain: `api.example.com` is under `example.com`, and so is `example.com` itself.
   */
  public isSubdomainOf(other: Hostname): boolean {
    const mine = this.value.toLowerCase();
    const theirs = other.value.toLowerCase();

    return mine === theirs || mine.endsWith(`.${theirs}`);
  }

  /**
   * Whether the other value is the same name, ignoring case, and belongs to this type, a type under
   * it or the type it is under, like `equals()` on every type.
   */
  public override equals(other: unknown): boolean {
    return (
      inOneLine(this, other) &&
      other instanceof Hostname &&
      other.value.toLowerCase() === this.value.toLowerCase()
    );
  }
}
