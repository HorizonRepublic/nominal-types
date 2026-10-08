export { Nominal } from './core/nominal.ts';
/**
 * The functions that build schemas, rules and checks, gathered under one name so a single
 * import brings all of them.
 *
 * @remarks
 * `n.object()`, `n.of()`, `n.record()`, `n.tuple()` and `n.union()` build schemas, and
 * `n.constraint()` checks fields together. `n.oneOf()`, `n.matching()` and `n.satisfying()` make
 * rules for `Nominal()`. `n.hideValues()` masks values in issues, and `n.plain()` turns instances
 * into plain values for a response. `n.isType()`, `n.isObject()` and `n.isConstraint()` tell what a value is.
 * `n.configure()` sets messages, values, trimming and code generation for the process.
 *
 * @example
 * ```ts
 * import { Email, n, Uuid } from '@horizon-republic/nominal-types';
 *
 * const CreateOrder = n.object({ customer: Uuid, contact: Email, items: n.of(Uuid).array() });
 * ```
 */
export * as n from './core/n.ts';
export type {
  AnyNominalType,
  Brand,
  Branded,
  BrandsOf,
  Immutable,
  ImplyingType,
  InputOf,
  Narrowed,
  NominalInstance,
  NominalOptions,
  NominalSchema,
  NominalType,
  ObjectCopy,
  ObjectInstance,
  ObjectRule,
  Parsed,
  SubtypeInstance,
  SubtypeOf,
  Unbranded,
  VariantInstance,
  VariantOf,
  ValueOf,
} from './core/contracts.ts';
export { NominalError } from './core/nominal-error.ts';
export type { Configuration, FullConfiguration } from './core/configure.ts';
export type { Logger } from './core/log.ts';
export { pinoLogger } from './core/pino-logger.ts';
export type { ObjectFirstLogger } from './core/pino-logger.ts';
export type {
  IssueCode,
  IssueDetails,
  MessageFunction,
  MessageMap,
  Messages,
  NominalIssue,
} from './core/issue-codes.ts';
export { PatternSchema } from './core/pattern-schema.ts';
export { PredicateSchema } from './core/predicate-schema.ts';
export { OneOfSchema } from './core/one-of.ts';
export type { OneOfValue } from './core/one-of.ts';
export type { StandardOf, StandardProps, StandardSchema } from './core/standard-schema.ts';
export type { StandardJSONSchemaV1, StandardSchemaV1 } from './core/standard-spec.ts';
export { Constraint } from './core/constraint.ts';
export type {
  AnyConstraint,
  ConstraintField,
  ConstraintInput,
  ConstraintInputs,
  ConstraintOptions,
  ConstraintValue,
  ConstraintValues,
  ConstraintVerdict,
} from './core/constraint-types.ts';
export { ObjectSchema } from './core/object-schema.ts';
export type { ObjectFields, ObjectInput, ObjectValue, TextInput } from './core/object-schema.ts';
export { RecordSchema } from './core/record-schema.ts';
export type { RecordInput, RecordKey, RecordValue } from './core/record-schema.ts';
export { TupleSchema } from './core/tuple-schema.ts';
export type { TupleValue } from './core/tuple-schema.ts';
export { TypeSchema } from './core/type-schema.ts';
export { UnionSchema } from './core/union-schema.ts';
export type { UnionInput, UnionValue, UnionVariants } from './core/union-schema.ts';
export type { Plain } from './core/plain.ts';
export type { NominalTarget, TargetValue } from './core/target.ts';
export type { ArrayOptions } from './core/array-bounds.ts';
export { AnyBigInt } from './types/bigint/any-bigint.ts';
export { AnyNumber } from './types/number/any-number.ts';
export { AnyBoolean } from './types/boolean/any-boolean.ts';
export { CountryCode } from './types/string/country-code.ts';
export { CurrencyCode } from './types/string/currency-code.ts';
export { Base64 } from './types/string/base64.ts';
export { Base64Url } from './types/string/base64-url.ts';
export { Bic } from './types/string/bic.ts';
export { DecimalString } from './types/string/decimal-string.ts';
export { E164PhoneNumber } from './types/string/e164-phone-number.ts';
export { Email } from './types/string/email.ts';
export { FiniteNumber } from './types/number/finite-number.ts';
export { Float32 } from './types/number/float32.ts';
export { HexColor } from './types/string/hex-color.ts';
export { Gtin } from './types/string/gtin.ts';
export { DomainName } from './types/string/domain-name.ts';
export { Hostname } from './types/string/hostname.ts';
export { HttpUrl } from './types/string/http-url.ts';
export { Int16 } from './types/number/int16.ts';
export { Int32 } from './types/number/int32.ts';
export { Int64 } from './types/bigint/int64.ts';
export { Int8 } from './types/number/int8.ts';
export { Integer } from './types/number/integer.ts';
export { LanguageTag } from './types/string/language-tag.ts';
export { MediaType } from './types/string/media-type.ts';
export { Latitude } from './types/number/latitude.ts';
export { Longitude } from './types/number/longitude.ts';
export { Iban } from './types/string/iban.ts';
export { IpAddress } from './types/string/ip-address.ts';
export { Isbn } from './types/string/isbn.ts';
export { Isin } from './types/string/isin.ts';
export { Issn } from './types/string/issn.ts';
export { Jwt } from './types/string/jwt.ts';
export { IpPrefix } from './types/string/ip-prefix.ts';
export { Ipv4Address } from './types/string/ipv4-address.ts';
export { Ipv4Prefix } from './types/string/ipv4-prefix.ts';
export { Ipv6Address } from './types/string/ipv6-address.ts';
export { Ipv6Prefix } from './types/string/ipv6-prefix.ts';
export { MacAddress } from './types/string/mac-address.ts';
export { Money } from './types/object/money.ts';
export { NegativeBigInt } from './types/bigint/negative-bigint.ts';
export { NegativeInteger } from './types/number/negative-integer.ts';
export { NegativeNumber } from './types/number/negative-number.ts';
export { NonBlankString } from './types/string/non-blank-string.ts';
export { NonEmptyString } from './types/string/non-empty-string.ts';
export { NonNegativeBigInt } from './types/bigint/non-negative-bigint.ts';
export { NonNegativeInteger } from './types/number/non-negative-integer.ts';
export { NonNegativeNumber } from './types/number/non-negative-number.ts';
export { NonPositiveBigInt } from './types/bigint/non-positive-bigint.ts';
export { NonPositiveInteger } from './types/number/non-positive-integer.ts';
export { NonPositiveNumber } from './types/number/non-positive-number.ts';
export { ObjectId } from './types/string/object-id.ts';
export { Port } from './types/number/port.ts';
export { PositiveBigInt } from './types/bigint/positive-bigint.ts';
export { PositiveInteger } from './types/number/positive-integer.ts';
export { PositiveNumber } from './types/number/positive-number.ts';
export { AnyString } from './types/string/any-string.ts';
export { SemVer } from './types/string/sem-ver.ts';
export { TypeId } from './types/string/type-id.ts';
export { Uint16 } from './types/number/uint16.ts';
export { Uint32 } from './types/number/uint32.ts';
export { Uint64 } from './types/bigint/uint64.ts';
export { Uint8 } from './types/number/uint8.ts';
export { Ulid } from './types/string/ulid.ts';
export { Url } from './types/string/url.ts';
export { Uuid } from './types/string/uuid.ts';
export { UuidV4 } from './types/string/uuid-v4.ts';
export { UuidV7 } from './types/string/uuid-v7.ts';
