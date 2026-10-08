import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { AnyString } from './any-string.ts';
import { labelFragment } from './dns-name.ts';

const atom = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
const label = labelFragment;
const topLevel = '(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})';
const address = `${atom}(?:\\.${atom})*@(?:${label}\\.)+${topLevel}`;
const pattern = new RegExp(`^(?=.{6,254}$)(?=[^@]{1,64}@)${address}$`, 'u');

const EmailBase: SubtypeOf<typeof AnyString, 'nominal.Email'> = AnyString.subtype(
  'nominal.Email',
  // JSON Schema tools built on RE2 have no lookaheads, so the schema states the limits of the
  // pattern as lengths, and refuses more than 64 characters before the @ with `not`.
  matching(pattern, 'an email address', {
    pattern: `^${address}$`,
    format: 'email',
    minLength: 6,
    maxLength: 254,
    not: { pattern: '^[^@]{65}' },
    examples: ['jane.doe@example.com'],
  }),
  { sensitive: true },
);

/**
 * An email address in the dot-atom form RFC 5322 defines, with plus addressing understood.
 *
 * @remarks
 * Quoted local parts, IP-literal domains and Unicode domains are rejected; a Unicode domain passes
 * once converted to punycode. Local parts stay as written, since the standard leaves their case to
 * the receiving server; `canonical()` lowers it for comparing people rather than strings.
 * An address is personal data, so messages leave it out: `must be an email address (was a string of
 * 4 characters)`.
 *
 * @example
 * ```ts
 * const email = new Email('Jane.Doe+news@Example.com');
 * email.tag; // 'news'
 * email.canonical().value; // 'jane.doe@example.com'
 * ```
 */
export class Email extends EmailBase {
  /**
   * The characters one dot-separated piece of the local part may hold, as a pattern fragment.
   */
  public static readonly atom: string = atom;

  /**
   * One domain label: letters, digits and inner hyphens, up to 63 characters.
   */
  public static readonly label: string = label;

  /**
   * The top-level domain: letters, or punycode for an internationalised one.
   */
  public static readonly topLevel: string = topLevel;

  /**
   * The whole address, assembled from the fragments above with the RFC 5321 length limits.
   *
   * @remarks
   * The rule is built from it once, when the class is defined, so a subclass that changes the
   * pattern overrides `rule` as well.
   *
   * @example
   * ```ts
   * class CompanyEmail extends Email {
   *   static override readonly pattern = /^[a-z.]+@example\.com$/u;
   *   static override readonly rule = n.matching(CompanyEmail.pattern);
   * }
   * ```
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * Everything before the `@`.
   */
  public get local(): string {
    return this.value.slice(0, this.value.lastIndexOf('@'));
  }

  /**
   * Everything after the `@`.
   */
  public get domain(): string {
    return this.value.slice(this.value.lastIndexOf('@') + 1);
  }

  /**
   * The local part without its plus tag: the mailbox mail actually lands in.
   */
  public get mailbox(): string {
    const local = this.local;
    const plus = local.indexOf('+');

    return plus === -1 ? local : local.slice(0, plus);
  }

  /**
   * What follows the first `+` in the local part, or `undefined` when the address carries no tag.
   */
  public get tag(): string | undefined {
    const local = this.local;
    const plus = local.indexOf('+');

    return plus === -1 ? undefined : local.slice(plus + 1);
  }

  /**
   * The same mailbox with the tag replaced.
   *
   * @throws NominalError when the tag carries characters an address cannot hold.
   */
  public withTag(tag: string): this {
    return sameType(this, `${this.mailbox}+${tag}@${this.domain}`);
  }

  /**
   * The same mailbox without any tag.
   */
  public withoutTag(): this {
    return sameType(this, `${this.mailbox}@${this.domain}`);
  }

  /**
   * The address lowered and stripped of its tag, for telling whether two addresses reach one
   * person.
   *
   * @remarks
   * Provider rules beyond that, such as Gmail ignoring dots, are left to the caller.
   */
  public canonical(): this {
    return sameType(this, `${this.mailbox}@${this.domain}`.toLowerCase());
  }

  /**
   * Whether both addresses reach the same mailbox once tags and case are set aside.
   */
  public isSameMailbox(other: Email): boolean {
    return this.canonical().value === other.canonical().value;
  }
}
