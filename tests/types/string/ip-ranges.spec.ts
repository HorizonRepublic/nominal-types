import { describe, expect, it } from 'vitest';

import { IpAddress } from '../../../src/index.ts';

const facts = (text: string): Record<string, boolean> => {
  const address = new IpAddress(text);

  return {
    global: address.isGlobal,
    private: address.isPrivate,
    loopback: address.isLoopback,
    linkLocal: address.isLinkLocal,
    multicast: address.isMulticast,
    unspecified: address.isUnspecified,
  };
};

const none = {
  global: false,
  private: false,
  loopback: false,
  linkLocal: false,
  multicast: false,
  unspecified: false,
};

describe('special-purpose addresses (RFC 6890)', () => {
  it.each([
    ['8.8.8.8', { global: true }],
    ['1.1.1.1', { global: true }],
    ['0.0.0.0', { unspecified: true }],
    ['0.1.2.3', {}],
    ['10.1.2.3', { private: true }],
    ['172.16.0.1', { private: true }],
    ['172.31.255.255', { private: true }],
    ['172.32.0.1', { global: true }],
    ['192.168.1.1', { private: true }],
    ['100.64.0.1', {}],
    ['127.0.0.1', { loopback: true }],
    ['127.255.255.254', { loopback: true }],
    ['169.254.169.254', { linkLocal: true }],
    ['192.0.0.1', {}],
    ['192.0.0.9', { global: true }],
    ['192.0.0.10', { global: true }],
    ['192.0.2.1', {}],
    ['198.18.0.1', {}],
    ['198.51.100.1', {}],
    ['203.0.113.1', {}],
    ['224.0.0.1', { multicast: true }],
    ['239.255.255.250', { multicast: true }],
    ['240.0.0.1', {}],
    ['255.255.255.255', {}],
    ['::', { unspecified: true }],
    ['::1', { loopback: true }],
    ['2606:4700::1111', { global: true }],
    ['2001:db8::1', {}],
    ['3fff::1', {}],
    ['fc00::1', { private: true }],
    ['fd12:3456::1', { private: true }],
    ['fe80::1', { linkLocal: true }],
    ['febf::1', { linkLocal: true }],
    ['ff02::1', { multicast: true }],
    ['ff0e::1', { multicast: true }],
    ['2001::1', {}],
    ['2001:2::1', {}],
    ['2001:1::1', { global: true }],
    ['2001:3::1', { global: true }],
    ['2001:20::1', { global: true }],
    ['100::1', {}],
    ['5f00::1', {}],
    ['1::1', {}],
    ['::ffff:127.0.0.1', { loopback: true }],
    ['::ffff:10.0.0.1', { private: true }],
    ['::ffff:8.8.8.8', { global: true }],
    ['::ffff:169.254.1.1', { linkLocal: true }],
    ['64:ff9b::8.8.8.8', { global: true }],
    ['64:ff9b::10.0.0.1', {}],
    ['64:ff9b:1::1', {}],
    ['2002:808:808::1', { global: true }],
    ['2002:a00:1::1', {}],
  ])('classifies %s', (text, expected) => {
    expect(facts(text)).toStrictEqual({ ...none, ...expected });
  });
});
