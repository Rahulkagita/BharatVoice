import { describe, expect, it } from 'vitest';
import { documentLanguageFor } from './locales';

describe('documentLanguageFor', () => {
  it('maps each interface language to its BCP-47 tag', () => {
    expect(documentLanguageFor('en')).toBe('en-IN');
    expect(documentLanguageFor('hi')).toBe('hi-IN');
    expect(documentLanguageFor('te')).toBe('te-IN');
  });
});
