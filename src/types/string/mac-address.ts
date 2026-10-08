import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { inOneLine } from '../../core/same-value.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyString } from './any-string.ts';
import { nonBlankString } from './non-blank-brands.ts';
import type { NonBlankString } from './non-blank-string.ts';

const pattern = /^(?:[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}|[0-9A-Fa-f]{2}(?:-[0-9A-Fa-f]{2}){5})$/u;

const MacAddressBase: SubtypeOf<
  typeof AnyString,
  'nominal.MacAddress',
  string,
  typeof NonBlankString
> = AnyString.subtype(
  'nominal.MacAddress',
  matching(pattern, 'a MAC address', {
    minLength: 17,
    maxLength: 17,
    examples: ['00:00:5e:00:53:01'],
  }),
  { implies: [nonBlankString], sensitive: true },
);

const firstOctet = (text: string): number => Number.parseInt(text.slice(0, 2), 16);

/**
 * A 48-bit MAC address (EUI-48), such as `00:00:5e:00:53:01`: six pairs of hex digits, all
 * separated by `:` or all by `-`, as IEEE 802 and RFC 7042 §2.1 write them.
 *
 * @remarks
 * Hex digits may come in either case. Mixed separators, no separators and the dotted form
 * `0000.5e00.5301` are refused. The value keeps the text as given; `equals` compares the bytes and
 * `canonical()` writes the lowercase form with colons. A MAC address identifies a device, so
 * messages leave it out.
 *
 * @example
 * ```ts
 * import { MacAddress } from '@horizon-republic/nominal-types';
 *
 * new MacAddress('00-00-5E-00-53-01').canonical().value; // '00:00:5e:00:53:01'
 * ```
 */
export class MacAddress extends MacAddressBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof MacAddress>;

  /**
   * The six pairs of hex digits as a pattern, in either case and with either separator.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The six bytes of the address, for a binary column or a network API.
   *
   * @returns A new array of 6 bytes.
   */
  public toBytes(): Uint8Array {
    return Uint8Array.from({ length: 6 }, (_, index) =>
      Number.parseInt(this.value.slice(index * 3, index * 3 + 2), 16),
    );
  }

  /**
   * Whether the address names a group of interfaces: the I/G bit, the lowest bit of the first byte.
   */
  public get isMulticast(): boolean {
    return (firstOctet(this.value) & 1) === 1;
  }

  /**
   * Whether the address was set locally rather than assigned by the maker: the U/L bit, the second
   * lowest bit of the first byte, as randomised addresses have it.
   */
  public get isLocallyAdministered(): boolean {
    return (firstOctet(this.value) & 2) === 2;
  }

  /**
   * The address in lowercase with colons, as Linux and most APIs print it.
   *
   * @returns An address of the same class.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form.
   */
  public canonical(): this {
    return sameType(this, this.value.toLowerCase().replaceAll('-', ':'));
  }

  /**
   * Whether the other value has the same bytes, whatever the case and separator, and belongs to
   * this type, a type under it or the type it is under, like `equals()` on every type.
   *
   * @param other - The value to compare with.
   * @returns `true` when both are the same address.
   */
  public override equals(other: unknown): boolean {
    return other instanceof MacAddress
      ? inOneLine(this, other) &&
          other.value.toLowerCase().replaceAll('-', ':') ===
            this.value.toLowerCase().replaceAll('-', ':')
      : super.equals(other);
  }
}
