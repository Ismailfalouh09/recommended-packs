import { buildMaskedDisplayName } from './author-display-name';

describe('buildMaskedDisplayName', () => {
  it('reduces a full name to a first name plus last initial', () => {
    expect(buildMaskedDisplayName('Ismail Falouh')).toBe('Ismail F.');
    expect(buildMaskedDisplayName('  maria del carmen ')).toBe('maria C.');
  });

  it('keeps a single name as-is', () => {
    expect(buildMaskedDisplayName('Ismail')).toBe('Ismail');
  });

  it('falls back to Anonymous for empty input', () => {
    expect(buildMaskedDisplayName('')).toBe('Anonymous');
    expect(buildMaskedDisplayName(null)).toBe('Anonymous');
    expect(buildMaskedDisplayName(undefined)).toBe('Anonymous');
  });
});
