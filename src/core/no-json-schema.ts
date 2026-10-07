/**
 * Internal: thrown by a rule of this package that was declared without a JSON Schema.
 */
export class NoJsonSchema extends TypeError {
  public constructor() {
    super('the schema cannot describe itself as JSON Schema');
    this.name = 'TypeError';
  }
}
