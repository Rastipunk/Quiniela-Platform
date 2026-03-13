/**
 * Typed error class for API responses.
 * Replaces raw `catch(e: any)` with structured error handling.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly payload: unknown;

  constructor(status: number, code: string, message: string, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/**
 * Extracts a user-friendly message from any caught error.
 * Use in catch blocks: `catch (e) { setError(getErrorMessage(e)); }`
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
}

/**
 * Type guard to check if an error is an ApiError.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
