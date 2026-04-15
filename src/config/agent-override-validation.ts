import { isAbsolute } from "node:path";
import { InvalidIdentifierError, UserConfigValidationError } from "../core/errors";
import { normalizeId } from "../core/ids";
import { supportedPlatforms, type SupportedPlatform } from "./default-agent-rules";

export function normalizeRelativePath(value: string, field: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new UserConfigValidationError(`${field} must not be empty`);
  }

  if (isAbsolute(trimmed)) {
    throw new UserConfigValidationError(`${field} must be a relative path`);
  }

  const normalized = trimmed.replaceAll("\\", "/");

  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new UserConfigValidationError(`${field} must stay within the configured home-relative tree`);
  }

  return normalized.replace(/^\.\/+/, "");
}

export function normalizeAgentId(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0 || /[a-z0-9]/i.test(trimmed) === false) {
    throw new InvalidIdentifierError("agent id", value);
  }

  return normalizeId(trimmed);
}

export function normalizePlatforms(value: string[] | undefined): SupportedPlatform[] {
  if (value === undefined || value.length === 0) {
    return [process.platform as SupportedPlatform];
  }

  const normalized = [...new Set(value.map((entry) => entry.trim().toLowerCase()))];
  const invalid = normalized.filter(
    (entry): entry is string => supportedPlatforms.includes(entry as SupportedPlatform) === false
  );

  if (invalid.length > 0) {
    throw new UserConfigValidationError(
      `platform must be one of: ${supportedPlatforms.join(", ")}`
    );
  }

  return normalized as SupportedPlatform[];
}
