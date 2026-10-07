import typia, { type tags } from 'typia';

export const isSku = typia.createIs<string & tags.Pattern<'^SKU-\\d{4}$'>>();
export const isUuid = typia.createIs<string & tags.Format<'uuid'>>();
export const isEmail = typia.createIs<string & tags.Format<'email'>>();
export const isPositiveInteger = typia.createIs<number & tags.Type<'int64'> & tags.Minimum<1>>();
export const isUuidList = typia.createIs<Array<string & tags.Format<'uuid'>>>();
export const validateSku = typia.createValidate<string & tags.Pattern<'^SKU-\\d{4}$'>>();

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
  priceMinor: number & tags.Type<'uint32'>;
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
