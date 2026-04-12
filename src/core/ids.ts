import { InvalidIdentifierError } from "./errors";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "skill";
}

export function isValidId(value: string): boolean {
  return ID_PATTERN.test(value);
}

export function assertValidId(value: string, kind = "identifier"): string {
  if (!isValidId(value)) {
    throw new InvalidIdentifierError(kind, value);
  }

  return value;
}
