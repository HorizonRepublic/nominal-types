/**
 * A large export document, the same on every run: customers with addresses, and orders with items.
 */
export interface ExportDocument {
  readonly exportId: string;
  readonly customers: ReadonlyArray<{
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly addresses: ReadonlyArray<{
      readonly country: string;
      readonly postcode: string;
      readonly line: string;
    }>;
  }>;
  readonly orders: ReadonlyArray<{
    readonly id: string;
    readonly customerId: string;
    readonly status: 'new' | 'paid' | 'shipped';
    readonly items: ReadonlyArray<{
      readonly sku: string;
      readonly quantity: number;
      readonly priceMinor: number;
    }>;
    readonly tags: readonly string[];
  }>;
}

const uuid = (seed: number): string => {
  const hex = seed.toString(16).padStart(12, '0');

  return `0190f1c2-3b4a-7c5d-8e9f-${hex.slice(-12)}`;
};

const statuses = ['new', 'paid', 'shipped'] as const;
const countries = ['UA', 'PL', 'DE', 'FR', 'US'];

/**
 * Builds the document, about 2.9 MB as JSON: 3000 customers with two addresses each, and 5500
 * orders with five items.
 */
export const buildDocument = (): ExportDocument => ({
  exportId: uuid(1),
  customers: Array.from({ length: 3000 }, (_, index) => ({
    id: uuid(10_000 + index),
    email: `customer.${index}@example.com`,
    name: `Customer ${index}`,
    addresses: Array.from({ length: 2 }, (__, line) => ({
      country: countries[(index + line) % countries.length] ?? 'UA',
      postcode: String(10_000 + ((index * 7 + line) % 90_000)),
      line: `${index + 1} Main Street, apartment ${line + 1}`,
    })),
  })),
  orders: Array.from({ length: 5500 }, (_, index) => ({
    id: uuid(100_000 + index),
    customerId: uuid(10_000 + (index % 3000)),
    status: statuses[index % statuses.length] ?? 'new',
    items: Array.from({ length: 5 }, (__, item) => ({
      sku: `SKU-${String((index * 5 + item) % 10_000).padStart(4, '0')}`,
      quantity: 1 + ((index + item) % 9),
      priceMinor: 100 + ((index * 31 + item * 17) % 100_000),
    })),
    tags: index % 4 === 0 ? ['priority', 'gift'] : ['standard'],
  })),
});

/**
 * The document with one bad value deep inside: the last item of the last order has quantity 0.
 */
export const withOneError = (document: ExportDocument): ExportDocument => ({
  ...document,
  orders: document.orders.map((order, index) =>
    index === document.orders.length - 1
      ? {
          ...order,
          items: order.items.map((item, at) =>
            at === order.items.length - 1 ? { ...item, quantity: 0 } : item,
          ),
        }
      : order,
  ),
});

/**
 * The document with many bad values: every hundredth customer's email is broken.
 */
export const withManyErrors = (document: ExportDocument): ExportDocument => ({
  ...document,
  customers: document.customers.map((customer, index) =>
    index % 100 === 0 ? { ...customer, email: `broken-${index}` } : customer,
  ),
});
