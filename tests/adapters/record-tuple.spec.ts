import 'reflect-metadata';
import { type } from 'arktype';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { graphql, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { fromArk, toArk } from '../../src/adapters/arktype/index.ts';
import { NominalField } from '../../src/adapters/class-validator/index.ts';
import { toGraphQL } from '../../src/adapters/graphql/index.ts';
import { NominalPipe } from '../../src/adapters/nest/index.ts';
import { columnKindOf } from '../../src/adapters/orm/column.ts';
import { openApiSchemaOf } from '../../src/adapters/swagger/openapi-schema.ts';
import { toZod } from '../../src/adapters/zod/index.ts';
import {
  Latitude,
  Longitude,
  n,
  NonEmptyString,
  Nominal,
  PositiveInteger,
} from '../../src/index.ts';
import { valueOf } from '../support/results.ts';

const Stock = n.record(NonEmptyString, PositiveInteger);
const Point = n.tuple([Latitude, Longitude]);

class StockLevels extends Nominal('test.adapters.StockLevels', Stock) {}
class GeoPoint extends Nominal('test.adapters.GeoPoint', Point) {}

class Warehouse {
  @NominalField(Stock)
  public stock!: unknown;

  @NominalField(Point.optional())
  public location?: unknown;
}

describe('records and tuples in the adapters', () => {
  it('are described by their JSON Schema in OpenAPI documents', () => {
    expect(openApiSchemaOf(Stock, 'ApiNominalProperty')).toMatchObject({
      type: 'object',
      additionalProperties: { type: 'integer' },
    });
    expect(openApiSchemaOf(Point, 'ApiNominalProperty')).toMatchObject({
      type: 'array',
      items: { anyOf: [{ title: 'nominal.Latitude' }, { title: 'nominal.Longitude' }] },
      minItems: 2,
      maxItems: 2,
    });
  });

  it('take a JSON column in the ORM adapters', () => {
    expect(columnKindOf(StockLevels)).toMatchObject({ kind: 'json' });
    expect(columnKindOf(GeoPoint)).toMatchObject({ kind: 'json' });
  });

  it('become a scalar holding the JSON value in GraphQL', async () => {
    const scalar = toGraphQL(GeoPoint);
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          echo: {
            type: scalar,
            args: { point: { type: scalar } },
            resolve: (_source, args: { readonly point: GeoPoint }) => args.point,
          },
        },
      }),
    });

    const echoed = await graphql({ schema, source: '{ echo(point: [50.45, 30.52]) }' });

    expect(JSON.stringify(echoed)).toBe('{"data":{"echo":[50.45,30.52]}}');
    expect((await graphql({ schema, source: '{ echo(point: [95, 1]) }' })).errors).toHaveLength(1);
  });

  it('are checked by class-validator through NominalField', () => {
    const good = plainToInstance(Warehouse, { stock: { apples: 3 }, location: [1, 2] });
    const bad = plainToInstance(Warehouse, { stock: { apples: 0 }, location: [1] });

    expect(validateSync(good)).toStrictEqual([]);
    expect(validateSync(bad).map(({ property }) => property)).toStrictEqual(['stock', 'location']);
  });

  it('are checked by the Nest pipe', () => {
    const pipe = new NominalPipe(Point);

    expect(n.plain(pipe.transform([1, 2], { type: 'body' }))).toStrictEqual([1, 2]);
    expect(() => pipe.transform([1], { type: 'body' })).toThrow('Bad Request');
  });

  it('work as types in ArkType and Zod', () => {
    const parsed = fromArk(type({ stock: toArk(StockLevels) })).parse({ stock: { a: 1 } });

    expect(valueOf(parsed).stock).toBeInstanceOf(StockLevels);
    expect(z.object({ point: toZod(GeoPoint) }).safeParse({ point: [1, 2] }).success).toBe(true);
    expect(z.object({ point: toZod(GeoPoint) }).safeParse({ point: [1] }).success).toBe(false);
  });
});
