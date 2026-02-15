import { describe, it, expect } from 'vitest';
import { API_BASE_URL, DEBOUNCE_DELAY, MAX_QUERY_LENGTH, MAX_ID_LENGTH } from '../constants';

describe('Constants', () => {
  it('should have valid API_BASE_URL', () => {
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe('string');
    expect(API_BASE_URL.length).toBeGreaterThan(0);
  });

  it('should have reasonable debounce delay', () => {
    expect(DEBOUNCE_DELAY).toBeGreaterThan(0);
    expect(DEBOUNCE_DELAY).toBeLessThan(1000);
    expect(typeof DEBOUNCE_DELAY).toBe('number');
  });

  it('should have reasonable query length limit', () => {
    expect(MAX_QUERY_LENGTH).toBeGreaterThan(0);
    expect(typeof MAX_QUERY_LENGTH).toBe('number');
  });

  it('should have reasonable ID length limit', () => {
    expect(MAX_ID_LENGTH).toBeGreaterThan(0);
    expect(MAX_ID_LENGTH).toBeGreaterThan(MAX_QUERY_LENGTH);
    expect(typeof MAX_ID_LENGTH).toBe('number');
  });
});
