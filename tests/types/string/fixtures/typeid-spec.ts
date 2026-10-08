// The test vectors of the TypeID specification, version 0.3.0, copied from spec/valid.yml
// (updated 2024-04-10) and spec/invalid.yml (updated 2024-05-18) of
// https://github.com/jetify-com/typeid on 8 October 2026.

export interface ValidTypeId {
  readonly name: string;
  readonly typeid: string;
  readonly prefix: string;
  readonly uuid: string;
}

export const validTypeIds: readonly ValidTypeId[] = [
  {
    name: 'nil',
    typeid: '00000000000000000000000000',
    prefix: '',
    uuid: '00000000-0000-0000-0000-000000000000',
  },
  {
    name: 'one',
    typeid: '00000000000000000000000001',
    prefix: '',
    uuid: '00000000-0000-0000-0000-000000000001',
  },
  {
    name: 'ten',
    typeid: '0000000000000000000000000a',
    prefix: '',
    uuid: '00000000-0000-0000-0000-00000000000a',
  },
  {
    name: 'sixteen',
    typeid: '0000000000000000000000000g',
    prefix: '',
    uuid: '00000000-0000-0000-0000-000000000010',
  },
  {
    name: 'thirty-two',
    typeid: '00000000000000000000000010',
    prefix: '',
    uuid: '00000000-0000-0000-0000-000000000020',
  },
  {
    name: 'max-valid',
    typeid: '7zzzzzzzzzzzzzzzzzzzzzzzzz',
    prefix: '',
    uuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  },
  {
    name: 'valid-alphabet',
    typeid: 'prefix_0123456789abcdefghjkmnpqrs',
    prefix: 'prefix',
    uuid: '0110c853-1d09-52d8-d73e-1194e95b5f19',
  },
  {
    name: 'valid-uuidv7',
    typeid: 'prefix_01h455vb4pex5vsknk084sn02q',
    prefix: 'prefix',
    uuid: '01890a5d-ac96-774b-bcce-b302099a8057',
  },
  {
    name: 'prefix-underscore',
    typeid: 'pre_fix_00000000000000000000000000',
    prefix: 'pre_fix',
    uuid: '00000000-0000-0000-0000-000000000000',
  },
];

export const invalidTypeIds: ReadonlyArray<readonly [name: string, typeid: string]> = [
  ['prefix-uppercase', 'PREFIX_00000000000000000000000000'],
  ['prefix-numeric', '12345_00000000000000000000000000'],
  ['prefix-period', 'pre.fix_00000000000000000000000000'],
  ['prefix-non-ascii', 'préfix_00000000000000000000000000'],
  ['prefix-spaces', '  prefix_00000000000000000000000000'],
  [
    'prefix-64-chars',
    'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijkl_00000000000000000000000000',
  ],
  ['separator-empty-prefix', '_00000000000000000000000000'],
  ['separator-empty', '_'],
  ['suffix-short', 'prefix_1234567890123456789012345'],
  ['suffix-long', 'prefix_123456789012345678901234567'],
  ['suffix-spaces', 'prefix_1234567890123456789012345 '],
  ['suffix-uppercase', 'prefix_0123456789ABCDEFGHJKMNPQRS'],
  ['suffix-hyphens', 'prefix_123456789-123456789-123456'],
  ['suffix-wrong-alphabet', 'prefix_ooooooiiiiiiuuuuuuulllllll'],
  ['suffix-ambiguous-crockford', 'prefix_i23456789ol23456789oi23456'],
  ['suffix-hyphens-crockford', 'prefix_123456789-0123456789-0123456'],
  ['suffix-overflow', 'prefix_8zzzzzzzzzzzzzzzzzzzzzzzzz'],
  ['prefix-underscore-start', '_prefix_00000000000000000000000000'],
  ['prefix-underscore-end', 'prefix__00000000000000000000000000'],
  ['empty', ''],
  ['prefix-empty', 'prefix_'],
];
