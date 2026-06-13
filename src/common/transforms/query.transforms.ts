export function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return value as boolean;
}

export function optionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return value as string | undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

export function optionalUppercase(value: unknown): string | undefined {
  const trimmed = optionalTrimmedString(value);

  return typeof trimmed === 'string' ? trimmed.toUpperCase() : trimmed;
}

export function optionalUpperSnake(value: unknown): string | undefined {
  const trimmed = optionalTrimmedString(value);

  if (typeof trimmed !== 'string') {
    return trimmed;
  }

  return trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

export function optionalLowercase(value: unknown): string | undefined {
  const trimmed = optionalTrimmedString(value);

  return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
}
