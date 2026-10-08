import { describe, expectTypeOf, it } from 'vitest';

import { AnyString, Email, n, PositiveInteger, Uuid } from '../../src/index.ts';
import type {
  ConstraintInput,
  ConstraintValue,
  InputOf,
  TargetValue,
  ValueOf,
} from '../../src/index.ts';

const Order = n.object({ customer: Email, quantity: PositiveInteger });

const Payment = n.union('method', {
  card: n.object({ token: AnyString }),
  invoice: n.object({ email: Email }),
});

interface OrderValue {
  readonly customer: Email;
  readonly quantity: PositiveInteger;
}

describe('TargetValue', () => {
  it('is the instance for a nominal type', () => {
    expectTypeOf<TargetValue<typeof Email>>().toEqualTypeOf<Email>();
    expectTypeOf<TargetValue<typeof Uuid>>().toEqualTypeOf<Uuid>();
  });

  it('is what n.of() gives, with arrays, optional and nullable values', () => {
    expectTypeOf<TargetValue<ReturnType<typeof n.of<typeof Email>>>>().toEqualTypeOf<Email>();
    expectTypeOf<TargetValue<typeof Order>>().toEqualTypeOf<ValueOf<typeof Order>>();

    const ids = n.of(Uuid).array();
    const maybe = n.of(Email).optional();
    const empty = n.of(Email).nullable();
    const orders = Order.array().optional();

    expectTypeOf<TargetValue<typeof ids>>().toEqualTypeOf<readonly Uuid[]>();
    expectTypeOf<TargetValue<typeof maybe>>().toEqualTypeOf<Email | undefined>();
    expectTypeOf<TargetValue<typeof empty>>().toEqualTypeOf<Email | null>();
    expectTypeOf<TargetValue<typeof orders>>().toEqualTypeOf<readonly OrderValue[] | undefined>();
  });

  it('gives each field of an n.object() as its output, not its input', () => {
    expectTypeOf<TargetValue<typeof Order>>().toEqualTypeOf<OrderValue>();
    expectTypeOf<TargetValue<typeof Order>['customer']>().toEqualTypeOf<Email>();
  });

  it('follows partial(), pick(), omit() and extend()', () => {
    const partial = Order.partial();
    const picked = Order.pick('customer');
    const omitted = Order.omit('customer');
    const extended = Order.extend({ id: Uuid });

    expectTypeOf<TargetValue<typeof partial>>().toEqualTypeOf<{
      readonly customer?: Email;
      readonly quantity?: PositiveInteger;
    }>();
    expectTypeOf<TargetValue<typeof picked>>().toEqualTypeOf<{ readonly customer: Email }>();
    expectTypeOf<TargetValue<typeof omitted>>().toEqualTypeOf<{
      readonly quantity: PositiveInteger;
    }>();
    expectTypeOf<TargetValue<typeof extended>>().toEqualTypeOf<{
      readonly customer: Email;
      readonly quantity: PositiveInteger;
      readonly id: Uuid;
    }>();
  });

  it('gives each variant of an n.union() with its tag', () => {
    expectTypeOf<TargetValue<typeof Payment>>().toEqualTypeOf<ValueOf<typeof Payment>>();
    expectTypeOf<
      Extract<TargetValue<typeof Payment>, { method: 'invoice' }>['email']
    >().toEqualTypeOf<Email>();
  });
});

describe('the field types of a constraint', () => {
  it('take the input and give the output of a schema', () => {
    expectTypeOf<ConstraintValue<typeof Order>>().toEqualTypeOf<OrderValue>();
    expectTypeOf<ConstraintInput<typeof Order>>().toEqualTypeOf<InputOf<typeof Order>>();
    expectTypeOf<ConstraintInput<typeof Email>>().toEqualTypeOf<string | Email>();
  });
});
