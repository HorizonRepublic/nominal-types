import type { SubtypeOf } from '../../core/contracts.ts';
import { sameType } from '../../core/same-type.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyString } from './any-string.ts';
import { atom, emailRule, label, pattern, topLevel } from './email-rule.ts';
import { nonBlankString } from './non-blank-brands.ts';
import type { NonBlankString } from './non-blank-string.ts';

const EmailBase: SubtypeOf<typeof AnyString, 'nominal.Email', string, typeof NonBlankString> =
  AnyString.subtype('nominal.Email', emailRule, { implies: [nonBlankString], sensitive: true });

/**
 * An email address in the dot-atom form RFC 5322 defines, with plus addressing understood.
 *
 * @remarks
 * Quoted local parts, IP-literal domains and Unicode domains are rejected; a Unicode domain passes
 * once converted to punycode. Local parts stay as written, since the standard leaves their case to
 * the receiving server; `canonical()` lowers it for comparing people rather than strings.
 * An address is personal data, so messages leave it out:
 * `must be an email address (was a string of 4 characters)`.
 *
 * @example
 * ```ts
 * import { Email } from '@horizon-republic/nominal-types';
 *
 * const email = new Email('Jane.Doe+news@Example.com');
 * email.tag; // 'news'
 * email.canonical().value; // 'jane.doe@example.com'
 * ```
 */
export class Email extends EmailBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof Email>;

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
   * import { Email, n } from '@horizon-republic/nominal-types';
   *
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
   * @param tag - The new tag, without the `+`.
   * @returns An address of the same class.
   * @throws {@link NominalError} when the tag carries characters an address cannot hold.
   */
  public withTag(tag: string): this {
    return sameType(this, `${this.mailbox}+${tag}@${this.domain}`);
  }

  /**
   * The same mailbox without any tag.
   *
   * @returns An address of the same class.
   * @throws {@link NominalError} when a subtype's own rule refuses the address without a tag.
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
   *
   * @returns An address of the same class.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form.
   */
  public canonical(): this {
    return sameType(this, `${this.mailbox}@${this.domain}`.toLowerCase());
  }

  /**
   * Whether both addresses reach the same mailbox once tags and case are set aside.
   *
   * @param other - The address to compare with.
   * @returns `true` when both reach the same mailbox.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form of either
   * address.
   */
  public isSameMailbox(other: Email): boolean {
    return this.canonical().value === other.canonical().value;
  }
}
