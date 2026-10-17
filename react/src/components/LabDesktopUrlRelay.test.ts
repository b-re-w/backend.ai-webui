import { parseRequest, requestKey } from './LabDesktopUrlRelay';
import { describe, expect, it } from 'vitest';

describe('requestKey', () => {
  it('picks the first GPU slot key by name, as the session xdg-open does', () => {
    expect(
      requestKey({
        cpu: '4',
        mem: '1g',
        'cuda-pro6000.shares': '1',
        'cuda-pro5000-72.shares': '0.3',
      }),
    ).toBe('cuda-pro5000-72');
  });

  it('accepts device slots and ignores unused ones', () => {
    expect(
      requestKey({ 'cuda-a6000.shares': '0', 'cuda-pro6000-spot.device': 1 }),
    ).toBe('cuda-pro6000-spot');
  });

  it('is null without a GPU slot', () => {
    expect(requestKey({ cpu: '1', mem: '1g' })).toBeNull();
  });
});

describe('parseRequest', () => {
  const since = 1_790_000_000_000; // ms
  const ns = (ms: number) => `${ms}000000`;

  it('returns a web URL written after the app started', () => {
    expect(
      parseRequest(`${ns(since + 5)} https://github.com/login/device\n`, since),
    ).toBe('https://github.com/login/device');
  });

  it('ignores requests from before the app started', () => {
    expect(parseRequest(`${ns(since - 5)} https://example.com`, since)).toBe(
      null,
    );
  });

  it('ignores anything but web and mail links', () => {
    expect(parseRequest(`${ns(since + 5)} file:///etc/passwd`, since)).toBe(
      null,
    );
    expect(parseRequest('', since)).toBe(null);
    expect(parseRequest('garbage', since)).toBe(null);
  });
});
