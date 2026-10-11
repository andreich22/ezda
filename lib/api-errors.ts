import {NextResponse} from "next/server";

export const API_ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  ROUTING_REQUEST_INVALID: "ROUTING_REQUEST_INVALID",
  LAYERS_REQUEST_INVALID: "LAYERS_REQUEST_INVALID",
  INVALID_JSON: "INVALID_JSON",
  BODY_TOO_LARGE: "BODY_TOO_LARGE",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  SAVE_FAILED: "SAVE_FAILED",
  LOAD_FAILED: "LOAD_FAILED",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  UPDATE_FAILED: "UPDATE_FAILED",
  DELETE_FAILED: "DELETE_FAILED",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export function errorResponse(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json({error: message, code}, {status});
}

/**
 * Server-side diagnostic log without secrets.
 * Never pass API keys, tokens, connection strings, or upstream bodies here.
 */
export function logServerError(scope: string, detail: string) {
  console.error(`[${scope}] ${detail}`);
}

export function logServerWarning(scope: string, detail: string) {
  console.warn(`[${scope}] ${detail}`);
}
