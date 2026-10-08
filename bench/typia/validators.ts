import typia, { type tags } from 'typia';

export const validateSku = typia.createValidate<string & tags.Pattern<'^SKU-\\d{4}$'>>();
export const validateUuid = typia.createValidate<string & tags.Format<'uuid'>>();
export const validateEmail = typia.createValidate<string & tags.Format<'email'>>();
export const validatePositiveInteger = typia.createValidate<
  number & tags.Type<'int64'> & tags.Minimum<1>
>();
export const validateUuidList = typia.createValidate<Array<string & tags.Format<'uuid'>>>();

type Uuid = string & tags.Format<'uuid'>;

interface Address {
  country: string & tags.Pattern<'^[A-Z]{2}$'>;
  postcode: string & tags.Pattern<'^[0-9]{5}$'>;
  line: string & tags.MinLength<1>;
}

interface Customer {
  id: Uuid;
  email: string & tags.Format<'email'>;
  name: string & tags.MinLength<1>;
  addresses: Address[];
}

interface Item {
  sku: string & tags.Pattern<'^SKU-\\d{4}$'>;
  quantity: number & tags.Type<'uint32'> & tags.Minimum<1>;
  price: { amountMinor: number & tags.Type<'uint32'>; currency: 'UAH' | 'EUR' | 'USD' };
}

interface Order {
  id: Uuid;
  customerId: Uuid;
  status: 'new' | 'paid' | 'shipped';
  items: Item[];
  tags: string[];
}

interface ExportDocument {
  exportId: Uuid;
  customers: Customer[];
  orders: Order[];
}

export const validateDocument = typia.createValidate<ExportDocument>();
