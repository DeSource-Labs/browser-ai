export interface JsonSchemaValidationResult {
  valid: boolean;
  errors: string[];
}

type JsonSchema = Record<string, unknown> | boolean;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isSchema = (value: unknown): value is JsonSchema => typeof value === 'boolean' || isRecord(value);
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

const sameJsonValue = (left: unknown, right: unknown, ancestors = new Set<object>()): boolean => {
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return left === right;
  if (Array.isArray(left) !== Array.isArray(right) || ancestors.has(left) || ancestors.has(right)) return false;
  ancestors.add(left);
  ancestors.add(right);
  try {
    if (Array.isArray(left) && Array.isArray(right)) {
      return left.length === right.length && left.every((item, index) => sameJsonValue(item, right[index], ancestors));
    }
    const a = left as Record<string, unknown>;
    const b = right as Record<string, unknown>;
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => hasOwn(b, key) && sameJsonValue(a[key], b[key], ancestors))
    );
  } finally {
    ancestors.delete(left);
    ancestors.delete(right);
  }
};

const matchesType = (value: unknown, type: string) => {
  switch (type) {
    case 'array':
      return Array.isArray(value);
    case 'integer':
      return Number.isInteger(value);
    case 'null':
      return value === null;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'object':
      return isRecord(value);
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return true;
  }
};

const validateNode = (
  value: unknown,
  schema: JsonSchema,
  path: string,
  errors: string[],
  ancestors: Set<object>
): void => {
  if (typeof schema === 'boolean') {
    if (!schema) errors.push(`${path} is rejected by the schema.`);
    return;
  }
  if (ancestors.has(schema)) {
    errors.push(`${path} uses an unsupported cyclic schema.`);
    return;
  }
  ancestors.add(schema);
  try {
    validateObjectNode(value, schema, path, errors, ancestors);
  } finally {
    ancestors.delete(schema);
  }
};

const validateObjectNode = (
  value: unknown,
  schema: Record<string, unknown>,
  path: string,
  errors: string[],
  ancestors: Set<object>
): void => {
  const allowedTypes =
    typeof schema.type === 'string'
      ? [schema.type]
      : Array.isArray(schema.type)
        ? schema.type.filter((item): item is string => typeof item === 'string')
        : [];
  if (allowedTypes.length && !allowedTypes.some((type) => matchesType(value, type))) {
    errors.push(`${path} must be ${allowedTypes.join(' or ')}.`);
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((item) => sameJsonValue(item, value))) {
    errors.push(`${path} must match one of the allowed values.`);
  }
  if (hasOwn(schema, 'const') && !sameJsonValue(schema.const, value))
    errors.push(`${path} must match the constant value.`);

  const matchesSchema = (childSchema: unknown) => {
    if (!isSchema(childSchema)) return false;
    const childErrors: string[] = [];
    validateNode(value, childSchema, path, childErrors, ancestors);
    return childErrors.length === 0;
  };

  if (Array.isArray(schema.allOf)) {
    schema.allOf.forEach((item) => {
      if (isSchema(item)) validateNode(value, item, path, errors, ancestors);
    });
  }
  if (Array.isArray(schema.anyOf)) {
    const valid = schema.anyOf.some(matchesSchema);
    if (!valid) errors.push(`${path} must match at least one allowed schema.`);
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter(matchesSchema).length;
    if (matches !== 1) errors.push(`${path} must match exactly one allowed schema.`);
  }

  if (typeof value === 'string') {
    let length = 0;
    if (typeof schema.minLength === 'number' || typeof schema.maxLength === 'number') {
      for (const _character of value) length += 1;
    }
    if (typeof schema.minLength === 'number' && length < schema.minLength) {
      errors.push(`${path} must contain at least ${schema.minLength} characters.`);
    }
    if (typeof schema.maxLength === 'number' && length > schema.maxLength) {
      errors.push(`${path} must contain at most ${schema.maxLength} characters.`);
    }
    if (typeof schema.pattern === 'string') {
      try {
        if (!new RegExp(schema.pattern, 'u').test(value)) errors.push(`${path} has an invalid format.`);
      } catch {
        errors.push(`${path} uses an invalid schema pattern.`);
      }
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${path} must be at least ${schema.minimum}.`);
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push(`${path} must be at most ${schema.maximum}.`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${path} must contain at least ${schema.minItems} items.`);
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      errors.push(`${path} must contain at most ${schema.maxItems} items.`);
    }
    if (isSchema(schema.items)) {
      value.forEach((item, index) =>
        validateNode(item, schema.items as JsonSchema, `${path}[${index}]`, errors, ancestors)
      );
    }
  }

  if (!isRecord(value)) return;
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === 'string')
    : [];
  required.forEach((key) => {
    if (!hasOwn(value, key)) errors.push(`${path}.${key} is required.`);
  });

  const properties = isRecord(schema.properties) ? schema.properties : {};
  Object.entries(properties).forEach(([key, childSchema]) => {
    if (hasOwn(value, key) && isSchema(childSchema))
      validateNode(value[key], childSchema, `${path}.${key}`, errors, ancestors);
  });
  if (isSchema(schema.additionalProperties)) {
    Object.keys(value).forEach((key) => {
      if (hasOwn(properties, key)) return;
      if (schema.additionalProperties === false) errors.push(`${path}.${key} is not allowed.`);
      else validateNode(value[key], schema.additionalProperties as JsonSchema, `${path}.${key}`, errors, ancestors);
    });
  }
};

/**
 * Validate a small JSON Schema subset: type, enum, const, allOf/anyOf/oneOf,
 * string lengths/pattern, minimum/maximum, array lengths/items, and object
 * required/properties/additionalProperties. Boolean subschemas are supported.
 * Unknown keywords and types are ignored; this is not a full draft validator
 * or a JSON-serializability check. References, formats, and conditional schemas
 * require custom validation. Cyclic schema traversal is rejected.
 */
export const validateJsonSchema = (value: unknown, schema: object | boolean): JsonSchemaValidationResult => {
  const errors: string[] = [];
  if (!isSchema(schema)) return { valid: true, errors };
  validateNode(value, schema, '$', errors, new Set());
  return { valid: errors.length === 0, errors };
};

export const assertJsonSchema = (value: unknown, schema: object | boolean, subject = 'Value') => {
  const result = validateJsonSchema(value, schema);
  if (!result.valid) throw new TypeError(`${subject} failed schema validation: ${result.errors.join(' ')}`);
};
