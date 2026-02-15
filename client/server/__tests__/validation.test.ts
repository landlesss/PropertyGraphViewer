import { describe, it, expect } from '@jest/globals';

// Import validation functions from index.ts
// Since they're not exported, we'll test them indirectly via API or extract them
// For now, let's create testable versions

const MAX_QUERY_LENGTH = 200;
const MAX_ID_LENGTH = 500;
const MIN_QUERY_LENGTH = 1;

function validateFunctionId(id: string): { valid: boolean; error?: string } {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: "Function ID is required" };
  }
  
  const trimmed = id.trim();
  if (trimmed === '') {
    return { valid: false, error: "Function ID cannot be empty" };
  }
  
  if (trimmed.length > MAX_ID_LENGTH) {
    return { valid: false, error: `Function ID too long (max ${MAX_ID_LENGTH} characters)` };
  }
  
  if (!/^[a-zA-Z0-9:_/@.\-]+$/.test(trimmed)) {
    return { valid: false, error: "Function ID contains invalid characters" };
  }
  
  return { valid: true };
}

function validateSearchQuery(query: string): { valid: boolean; sanitized: string; error?: string } {
  if (typeof query !== 'string') {
    return { valid: false, sanitized: '', error: "Query must be a string" };
  }
  
  let sanitized = query.trim();
  
  if (sanitized.length > 0 && sanitized.length < MIN_QUERY_LENGTH) {
    return { valid: false, sanitized: '', error: `Query too short (min ${MIN_QUERY_LENGTH} character)` };
  }
  
  if (sanitized.length > MAX_QUERY_LENGTH) {
    sanitized = sanitized.substring(0, MAX_QUERY_LENGTH);
  }
  
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  sanitized = sanitized.replace(/[%_]/g, '\\$&');
  
  return { valid: true, sanitized };
}

function sanitizeNodeId(nodeId: string): { valid: boolean; sanitized: string; error?: string } {
  if (!nodeId || typeof nodeId !== 'string') {
    return { valid: false, sanitized: '', error: "Node ID is required" };
  }
  
  let sanitized: string;
  try {
    sanitized = decodeURIComponent(nodeId);
  } catch (e) {
    sanitized = nodeId;
  }
  
  sanitized = sanitized.trim();
  
  if (sanitized === '') {
    return { valid: false, sanitized: '', error: "Node ID cannot be empty" };
  }
  
  if (sanitized.length > MAX_ID_LENGTH) {
    return { valid: false, sanitized: '', error: `Node ID too long (max ${MAX_ID_LENGTH} characters)` };
  }
  
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  if (!/^[a-zA-Z0-9:_/@.\-]+$/.test(sanitized)) {
    return { valid: false, sanitized: '', error: "Node ID contains invalid characters" };
  }
  
  return { valid: true, sanitized };
}

describe('Validation Functions', () => {
  describe('validateFunctionId', () => {
    it('should accept valid function IDs', () => {
      const validIds = [
        'client_golang/prometheus::*Registry.Collect@registry.go:575:1',
        'package::function@file.go:10:5',
        'ext::path/filepath.Base',
        'simple_function',
        'function_with_underscores',
      ];
      
      validIds.forEach(id => {
        const result = validateFunctionId(id);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject empty or whitespace-only IDs', () => {
      expect(validateFunctionId('')).toEqual({
        valid: false,
        error: "Function ID cannot be empty"
      });
      expect(validateFunctionId('   ')).toEqual({
        valid: false,
        error: "Function ID cannot be empty"
      });
    });

    it('should reject IDs that are too long', () => {
      const longId = 'a'.repeat(MAX_ID_LENGTH + 1);
      const result = validateFunctionId(longId);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject IDs with invalid characters', () => {
      const invalidIds = [
        'function<script>',
        'function; DROP TABLE',
        'function\nnewline',
        'function\twith\ttabs',
        'function with spaces',
      ];
      
      invalidIds.forEach(id => {
        const result = validateFunctionId(id);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
      });
    });

    it('should reject non-string inputs', () => {
      // @ts-expect-error - testing invalid input
      expect(validateFunctionId(null)).toEqual({
        valid: false,
        error: "Function ID is required"
      });
      // @ts-expect-error - testing invalid input
      expect(validateFunctionId(123)).toEqual({
        valid: false,
        error: "Function ID is required"
      });
    });
  });

  describe('validateSearchQuery', () => {
    it('should accept valid search queries', () => {
      const validQueries = [
        'Collect',
        'Registry',
        'function_name',
        'a', // minimum length
      ];
      
      validQueries.forEach(query => {
        const result = validateSearchQuery(query);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBeTruthy();
      });
    });

    it('should allow empty queries', () => {
      const result = validateSearchQuery('');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('');
    });

    it('should trim whitespace', () => {
      const result = validateSearchQuery('  Collect  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Collect');
    });

    it('should escape SQL LIKE special characters', () => {
      const result = validateSearchQuery('test%query');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('test\\%query');
      
      const result2 = validateSearchQuery('test_query');
      expect(result.valid).toBe(true);
      expect(result2.sanitized).toBe('test\\_query');
    });

    it('should truncate queries that are too long', () => {
      const longQuery = 'a'.repeat(MAX_QUERY_LENGTH + 100);
      const result = validateSearchQuery(longQuery);
      expect(result.valid).toBe(true);
      expect(result.sanitized.length).toBe(MAX_QUERY_LENGTH);
    });

    it('should remove control characters', () => {
      const queryWithControl = 'test\x00\x01\x02query';
      const result = validateSearchQuery(queryWithControl);
      expect(result.valid).toBe(true);
      expect(result.sanitized).not.toContain('\x00');
      expect(result.sanitized).not.toContain('\x01');
    });

    it('should reject non-string inputs', () => {
      // @ts-expect-error - testing invalid input
      const result = validateSearchQuery(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('string');
    });
  });

  describe('sanitizeNodeId', () => {
    it('should accept valid node IDs', () => {
      const validIds = [
        'client_golang/prometheus::*Registry.Collect@registry.go:575:1',
        'ext::path/filepath.Base',
        'simple_node',
      ];
      
      validIds.forEach(id => {
        const result = sanitizeNodeId(id);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBeTruthy();
      });
    });

    it('should decode URL-encoded IDs', () => {
      const encoded = encodeURIComponent('package::function@file.go:10:5');
      const result = sanitizeNodeId(encoded);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('package::function@file.go:10:5');
    });

    it('should reject empty IDs', () => {
      const result = sanitizeNodeId('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('should reject IDs that are too long', () => {
      const longId = 'a'.repeat(MAX_ID_LENGTH + 1);
      const result = sanitizeNodeId(longId);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject IDs with invalid characters', () => {
      const invalidIds = [
        'node<script>',
        'node; DROP TABLE',
        'node\nnewline',
      ];
      
      invalidIds.forEach(id => {
        const result = sanitizeNodeId(id);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
      });
    });

    it('should handle malformed URL encoding gracefully', () => {
      const malformed = '%E0%A4%A'; // incomplete encoding
      const result = sanitizeNodeId(malformed);
      // Should not crash, but may not decode properly
      expect(result).toHaveProperty('valid');
    });
  });
});
