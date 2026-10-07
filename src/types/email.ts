import { type } from 'arktype';
import type { Type } from 'arktype';

import type { NominalType } from '../core/contracts.ts';
import { Nominal } from '../core/nominal.ts';

const atom = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
const label = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
const topLevel = '(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})';
const address = new RegExp(
  `^(?=.{6,254}$)(?=[^@]{1,64}@)${atom}(?:\\.${atom})*@(?:${label}\\.)+${topLevel}$`,
  'u',
);

const emailSchema: Type<string> = type(address).describe('an email address');

const EmailBase: NominalType<'Email', Type<string>> = Nominal('Email', emailSchema);

/**
 * An email address in the dot-atom form RFC 5322 defines, with plus addressing understood.
 *
 * @remarks
 * Quoted local parts, IP-literal domains and Unicode domains are rejected; a Unicode domain passes
 * once converted to punycode. Local parts stay as written, since the standard leaves their case to
 * the receiving server; `canonical()` lowers it for comparing people rather than strings.
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
  public withTag(tag: string): Email {
    return new Email(`${this.mailbox}+${tag}@${this.domain}`);
  }

  /**
   * The same mailbox without any tag.
   */
  public withoutTag(): Email {
    return new Email(`${this.mailbox}@${this.domain}`);
  }

  /**
   * The address lowered and stripped of its tag, for telling whether two addresses reach one
   * person.
   *
   * @remarks
   * Provider rules beyond that, such as Gmail ignoring dots, are left to the caller.
   */
  public canonical(): Email {
    return new Email(`${this.mailbox}@${this.domain}`.toLowerCase());
  }

  /**
   * Whether both addresses reach the same mailbox once tags and case are set aside.
   */
  public isSameMailbox(other: Email): boolean {
    return this.canonical().value === other.canonical().value;
  }
}
