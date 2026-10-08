/**
 * Thrown by a rule of this package that was declared without a JSON Schema.
 *
 * @internal
 */
export class NoJsonSchema extends TypeError {
  public constructor() {
    super('the schema cannot describe itself as JSON Schema');
    this.name = 'TypeError';
  }
}
