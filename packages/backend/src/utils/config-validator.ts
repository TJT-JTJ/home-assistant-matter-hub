export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ConfigSchema {
  [key: string]: {
    type: "string" | "number" | "boolean" | "array" | "object";
    required?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    enum?: unknown[];
    validate?: (value: unknown) => string | null;
  };
}

export function validateConfig(
  config: Record<string, unknown>,
  schema: ConfigSchema,
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = config[field];

    if (rules.required && (value === undefined || value === null)) {
      errors.push({
        field,
        message: `${field} is required`,
        value,
      });
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== rules.type) {
      errors.push({
        field,
        message: `${field} must be of type ${rules.type}, got ${actualType}`,
        value,
      });
      continue;
    }

    if (rules.type === "number") {
      const num = value as number;
      if (rules.min !== undefined && num < rules.min) {
        errors.push({
          field,
          message: `${field} must be at least ${rules.min}`,
          value,
        });
      }
      if (rules.max !== undefined && num > rules.max) {
        errors.push({
          field,
          message: `${field} must be at most ${rules.max}`,
          value,
        });
      }
    }

    if (rules.type === "string") {
      const str = value as string;
      if (rules.minLength !== undefined && str.length < rules.minLength) {
        errors.push({
          field,
          message: `${field} must be at least ${rules.minLength} characters`,
          value,
        });
      }
      if (rules.maxLength !== undefined && str.length > rules.maxLength) {
        errors.push({
          field,
          message: `${field} must be at most ${rules.maxLength} characters`,
          value,
        });
      }
      if (rules.pattern && !rules.pattern.test(str)) {
        errors.push({
          field,
          message: `${field} does not match the required pattern`,
          value,
        });
      }
    }

    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({
        field,
        message: `${field} must be one of: ${rules.enum.join(", ")}`,
        value,
      });
    }

    if (rules.validate) {
      const customError = rules.validate(value);
      if (customError) {
        errors.push({
          field,
          message: customError,
          value,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export const startOptionsSchema: ConfigSchema = {
  homeAssistantUrl: {
    type: "string",
    required: true,
    minLength: 1,
    validate: (value) => {
      const url = value as string;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return "homeAssistantUrl must start with http:// or https://";
      }
      return null;
    },
  },
  homeAssistantAccessToken: {
    type: "string",
    required: true,
    minLength: 10,
  },
  httpPort: {
    type: "number",
    required: true,
    min: 1,
    max: 65535,
  },
  logLevel: {
    type: "string",
    enum: ["debug", "info", "warn", "error"],
  },
  homeAssistantRefreshInterval: {
    type: "number",
    min: 1000,
    max: 3600000,
  },
};

export function validateStartOptions(
  options: Record<string, unknown>,
): ValidationResult {
  return validateConfig(options, startOptionsSchema);
}
