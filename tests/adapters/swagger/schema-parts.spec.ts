import 'reflect-metadata';
import { Body, Controller, Post, Put } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  ApiNominalBody,
  ApiNominalProperty,
  applyNominalTypes,
} from '../../../src/adapters/swagger/index.ts';
import { DomainName, Int64, n, UuidV4 } from '../../../src/index.ts';
import { documentFor } from './support.ts';

class Owner extends UuidV4.subtype('swaggerparts.Owner') {}

class PartsDto {
  @ApiNominalProperty(UuidV4)
  public id!: UuidV4;

  @ApiNominalProperty(DomainName)
  public domain!: DomainName;

  @ApiNominalProperty(n.of(UuidV4).array())
  public ids!: readonly UuidV4[];

  @ApiNominalProperty(Int64)
  public big!: Int64;

  @ApiProperty()
  public owner!: Owner;

  @ApiProperty({ allOf: [{ type: 'string' }, { minLength: 2 }] })
  public own!: string;
}

@Controller('parts')
class PartsController {
  @Post()
  public create(@Body() body: PartsDto): unknown {
    return body;
  }

  @Put()
  @ApiNominalBody(UuidV4)
  public replace(@Body() id: unknown): unknown {
    return id;
  }
}

const propertiesOf = (from: OpenAPIObject): Record<string, unknown> => {
  const properties: unknown = Reflect.get(
    from.components?.schemas?.['PartsDto'] ?? {},
    'properties',
  );

  return typeof properties === 'object' && properties !== null ? { ...properties } : {};
};

const bodyOf = (from: OpenAPIObject): unknown =>
  Reflect.get(from.paths['/parts']?.put?.requestBody ?? {}, 'content');

describe('schemas made of parts', () => {
  let raw: OpenAPIObject;
  let document: OpenAPIObject;

  beforeAll(async () => {
    raw = await documentFor(PartsController);
    document = applyNominalTypes(raw);
  });

  it('keeps the parts in the property instead of referring to an empty class schema', () => {
    expect(propertiesOf(raw)['id']).toMatchObject({
      title: 'nominal.UuidV4',
      allOf: [{ format: 'uuid' }, { pattern: '^.{14}4' }],
    });
    expect(raw.components?.schemas).not.toHaveProperty('UuidV4');
    expect(raw.components?.schemas).not.toHaveProperty('DomainName');
  });

  it('shows that @nestjs/swagger drops the type next to the parts', () => {
    expect(propertiesOf(raw)['id']).not.toHaveProperty('type');
  });

  it('puts the type back where every part has the same one', () => {
    const properties = propertiesOf(document);

    expect(properties['id']).toMatchObject({ type: 'string', allOf: [{}, {}] });
    expect(properties['domain']).toMatchObject({ type: 'string' });
    expect(properties['ids']).toMatchObject({ type: 'array', items: { type: 'string' } });
    expect(document.components?.schemas?.['Owner']).toMatchObject({
      title: 'swaggerparts.Owner',
      type: 'string',
    });
  });

  it('puts the type back in a request body too', () => {
    expect(bodyOf(document)).toMatchObject({
      'application/json': { schema: { title: 'nominal.UuidV4', type: 'string' } },
    });
  });

  it('leaves out the type where the parts allow a string or a number', () => {
    expect(propertiesOf(document)['big']).toMatchObject({ title: 'nominal.Int64' });
    expect(propertiesOf(document)['big']).not.toHaveProperty('type');
  });

  it('leaves schemas that are not nominal types alone', () => {
    expect(propertiesOf(raw)['own']).toMatchObject({ allOf: [{}, {}] });
    expect(propertiesOf(document)['own']).toStrictEqual(propertiesOf(raw)['own']);
  });

  it("doesn't change the document it was given", () => {
    expect(propertiesOf(raw)['domain']).not.toHaveProperty('type');
    expect(bodyOf(raw)).not.toMatchObject({ 'application/json': { schema: { type: 'string' } } });
  });
});
