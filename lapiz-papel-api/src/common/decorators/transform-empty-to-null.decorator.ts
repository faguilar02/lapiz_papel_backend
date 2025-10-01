import { Transform } from 'class-transformer';

/**
 * Transformer that converts empty strings to null
 * Useful for optional fields that should be null instead of empty string
 */
export function TransformEmptyToNull() {
  return Transform(({ value }) => {
    if (value === '' || value === undefined) {
      return null;
    }
    return value;
  });
}
