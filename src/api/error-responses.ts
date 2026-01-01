import type { Response } from "express";

interface ErrorResponseDetails {
  fieldErrors?: Record<string, string[]>;
  formErrors?: string[];
}

interface ErrorResponse {
  status: number;
  error: string;
  message: string;
  details?: ErrorResponseDetails;
  timestamp: string;
}

/**
 * Send a 400 Bad Request response with consistent format
 */
export function badRequest(
  res: Response,
  details?: ErrorResponseDetails,
  message: string = "Invalid request",
): void {
  const response: ErrorResponse = {
    status: 400,
    error: "bad_request",
    message,
    timestamp: new Date().toISOString(),
  };
  if (details) {
    response.details = details;
  }
  res.status(400).json(response);
}

/**
 * Send a 404 Not Found response with consistent format
 */
export function notFound(res: Response, resource: string): void {
  res.status(404).json({
    status: 404,
    error: "not_found",
    message: `${resource} not found`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send a 500 Internal Server Error response with consistent format
 */
export function serverError(res: Response, message: string = "Internal server error"): void {
  res.status(500).json({
    status: 500,
    error: "internal_error",
    message,
    timestamp: new Date().toISOString(),
  });
}
