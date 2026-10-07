import typia, { type tags } from 'typia';

export const isSku = typia.createIs<string & tags.Pattern<'^SKU-\\d{4}$'>>();
export const isUuid = typia.createIs<string & tags.Format<'uuid'>>();
export const isEmail = typia.createIs<string & tags.Format<'email'>>();
export const isPositiveInteger = typia.createIs<number & tags.Type<'int64'> & tags.Minimum<1>>();
export const isUuidList = typia.createIs<Array<string & tags.Format<'uuid'>>>();
export const validateSku = typia.createValidate<string & tags.Pattern<'^SKU-\\d{4}$'>>();
