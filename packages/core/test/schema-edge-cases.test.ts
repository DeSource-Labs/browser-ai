import { describe, expect, it } from 'vitest';
import { assertJsonSchema, validateJsonSchema } from '../src';

describe('supported JSON Schema edge cases', () => {
  it('compares object enum and const values independent of key order at every depth', () => {
    const expected = { name: 'entry', details: { first: 1, second: [true, { a: 1, b: 2 }] } };
    const reordered = { details: { second: [true, { b: 2, a: 1 }], first: 1 }, name: 'entry' };
    expect(validateJsonSchema(reordered, { enum: [expected], const: expected }).valid).toBe(true);
    expect(validateJsonSchema({ ...reordered, name: 'different' }, { enum: [expected] }).valid).toBe(false);
    expect(validateJsonSchema([2, 1], { enum: [[1, 2]] }).valid).toBe(false);
    expect(validateJsonSchema({ 0: 1 }, { enum: [[1]] }).valid).toBe(false);
    expect(validateJsonSchema(-0, { const: 0 }).valid).toBe(true);
  });

  it('requires own input properties including names inherited from Object.prototype', () => {
    expect(validateJsonSchema({}, { required: ['constructor'] }).valid).toBe(false);
    const inherited = Object.create({ token: 'inherited' }) as Record<string, unknown>;
    expect(validateJsonSchema(inherited, { required: ['token'] }).valid).toBe(false);
    expect(validateJsonSchema({ constructor: 'own' }, { required: ['constructor'] }).valid).toBe(true);
    expect(validateJsonSchema({ hasOwnProperty: 'own' }, { required: ['hasOwnProperty'] }).valid).toBe(true);
  });

  it('validates only own input properties and rejects undeclared prototype-named properties', () => {
    expect(validateJsonSchema({}, { properties: { constructor: { type: 'string' } } }).valid).toBe(true);
    const input = JSON.parse('{"constructor":"own","__proto__":"own"}') as object;
    const result = validateJsonSchema(input, { properties: {}, additionalProperties: false });
    expect(result.errors).toContain('$.constructor is not allowed.');
    expect(result.errors).toContain('$.__proto__ is not allowed.');
    const properties = JSON.parse('{"constructor":{"type":"string"},"__proto__":{"type":"string"}}') as object;
    expect(validateJsonSchema(input, { properties, additionalProperties: false }).valid).toBe(true);
  });

  it('does not treat inherited schema property names as declared properties', () => {
    const properties = Object.create({ hidden: { type: 'string' } }) as object;
    expect(validateJsonSchema({ hidden: 'value' }, { properties, additionalProperties: false }).valid).toBe(false);
  });

  it('counts Unicode code points for length constraints', () => {
    expect(validateJsonSchema('😀', { minLength: 1, maxLength: 1 }).valid).toBe(true);
    expect(validateJsonSchema('😀', { minLength: 2 }).valid).toBe(false);
    expect(validateJsonSchema('😀a', { maxLength: 1 }).valid).toBe(false);
    expect(validateJsonSchema('e\u0301', { minLength: 2, maxLength: 2 }).valid).toBe(true);
  });

  it('supports boolean schemas at the root and within objects and arrays', () => {
    expect(validateJsonSchema('anything', true).valid).toBe(true);
    expect(validateJsonSchema('anything', false).valid).toBe(false);
    expect(() => assertJsonSchema({}, false)).toThrow('schema validation');
    expect(validateJsonSchema({}, { properties: { forbidden: false } }).valid).toBe(true);
    expect(validateJsonSchema({ forbidden: 1 }, { properties: { forbidden: false } }).valid).toBe(false);
    expect(validateJsonSchema([1], { items: false }).valid).toBe(false);
    expect(validateJsonSchema([], { items: false }).valid).toBe(true);
    expect(validateJsonSchema([1], { items: true }).valid).toBe(true);
  });

  it('counts boolean branches in schema combinations', () => {
    expect(validateJsonSchema(1, { allOf: [true, false] }).valid).toBe(false);
    expect(validateJsonSchema(1, { anyOf: [false, true] }).valid).toBe(true);
    expect(validateJsonSchema(1, { oneOf: [true, true] }).valid).toBe(false);
    expect(validateJsonSchema(1, { oneOf: [false, true] }).valid).toBe(true);
  });

  it('validates undeclared properties against an additionalProperties schema', () => {
    const schema = { properties: { label: { type: 'string' } }, additionalProperties: { type: 'integer' } };
    expect(validateJsonSchema({ label: 'item', count: 2 }, schema).valid).toBe(true);
    expect(validateJsonSchema({ label: 'item', count: 'two' }, schema).errors).toContain('$.count must be integer.');
    expect(validateJsonSchema({ any: null }, { additionalProperties: true }).valid).toBe(true);
  });

  it('rejects cyclic comparisons without rejecting reused acyclic values', () => {
    const first: Record<string, unknown> = {};
    const second: Record<string, unknown> = {};
    first.self = first;
    second.self = second;
    expect(validateJsonSchema(first, { const: second }).valid).toBe(false);
    expect(validateJsonSchema(first, { enum: [first] }).valid).toBe(false);
    const shared = { value: 1 };
    expect(validateJsonSchema({ a: shared, b: shared }, { const: { b: { value: 1 }, a: { value: 1 } } }).valid).toBe(
      true
    );
  });

  it('rejects cyclic schema traversal without overflowing the stack', () => {
    const schema: Record<string, unknown> = {};
    schema.anyOf = [schema];
    expect(validateJsonSchema({}, schema).valid).toBe(false);
    schema.anyOf = undefined;
    schema.properties = { child: schema };
    const value: Record<string, unknown> = {};
    value.child = value;
    expect(validateJsonSchema(value, schema).errors.join(' ')).toContain('cyclic schema');
  });
});
