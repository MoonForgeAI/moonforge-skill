import { describe, expect, it } from 'vitest';
import {
  exceptionFingerprint,
  messageFingerprint,
  networkFingerprint,
  urlPath,
} from '../../skills/moonforge-implement/assets/moonforge-sdk/error-fingerprint.js';

describe('error fingerprints', () => {
  it('exception fingerprint = type + message + top stack frame', () => {
    const top = { function: 'load', filename: 'https://g.example/app.js', lineno: 10, colno: 5 };
    const a = exceptionFingerprint('TypeError', 'boom', [top, { function: 'x', filename: 'y', lineno: 1, colno: 1 }]);
    const b = exceptionFingerprint('TypeError', 'boom', [top]);
    expect(a).toBe(b); // only the top frame participates
    expect(exceptionFingerprint('RangeError', 'boom', [top])).not.toBe(a);
    expect(exceptionFingerprint('TypeError', 'other', [top])).not.toBe(a);
    expect(exceptionFingerprint('TypeError', 'boom', [{ ...top, lineno: 11 }])).not.toBe(a);
    expect(exceptionFingerprint('TypeError', 'boom', [])).not.toBe(a);
  });

  it('message fingerprint distinguishes level and text', () => {
    expect(messageFingerprint('warning', 'x')).toBe(messageFingerprint('warning', 'x'));
    expect(messageFingerprint('warning', 'x')).not.toBe(messageFingerprint('error', 'x'));
  });

  it('network fingerprint = method + URL path (no query string) + status', () => {
    const a = networkFingerprint('GET', 'https://api.g.example/session?token=abc', 500);
    expect(networkFingerprint('get', 'https://api.g.example/session?token=xyz#f', 500)).toBe(a);
    expect(networkFingerprint('POST', 'https://api.g.example/session', 500)).not.toBe(a);
    expect(networkFingerprint('GET', 'https://api.g.example/session', 502)).not.toBe(a);
    expect(networkFingerprint('GET', 'https://api.g.example/other', 500)).not.toBe(a);
    expect(networkFingerprint('GET', 'https://api.g.example/session', undefined))
      .toBe(networkFingerprint('GET', 'https://api.g.example/session?q=1', undefined));
  });

  it('urlPath strips query and hash, tolerating relative and unparseable input', () => {
    expect(urlPath('https://a.example/p/q?x=1#h')).toBe('https://a.example/p/q');
    expect(urlPath('/api/save?x=1')).toMatch(/\/api\/save$/);
    expect(urlPath('not a url?x=1#y')).not.toContain('?');
    expect(urlPath(undefined)).toBe('');
  });
});
