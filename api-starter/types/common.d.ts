declare module 'common' {
  export interface ApiResponse {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }

  export interface ValidationResult {
    valid: boolean;
    errors: string[];
  }

  export interface JwtVerifyResult {
    valid: boolean;
    error?: string;
    payload?: Record<string, unknown>;
  }

  export function formatResponse(statusCode: number, body: unknown): ApiResponse;
  export function validateItem(input: unknown): ValidationResult;
  export function validatePartialItem(input: unknown): ValidationResult;
  export function generateJwt(payload: Record<string, unknown>, secret: string, expiresInSeconds: number): string;
  export function verifyJwt(token: string, secret: string): JwtVerifyResult;
}
