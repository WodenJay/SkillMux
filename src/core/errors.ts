export class SkillMuxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidIdentifierError extends SkillMuxError {
  constructor(
    public readonly kind: string,
    public readonly value: string
  ) {
    super(`Invalid ${kind}: ${value}`);
  }
}

export class ManifestValidationError extends SkillMuxError {
  constructor(message: string) {
    super(message);
  }
}

export class UserConfigValidationError extends SkillMuxError {
  constructor(message: string) {
    super(message);
  }
}

export class AdoptionError extends SkillMuxError {
  constructor(message: string) {
    super(message);
  }
}
