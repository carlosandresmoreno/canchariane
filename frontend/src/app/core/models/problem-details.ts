export interface InvalidParam {
  name: string;
  reason: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code?: string;
  invalid_params?: InvalidParam[];
  [key: string]: unknown;
}

export function isProblemDetails(error: unknown): error is ProblemDetails {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'title' in error &&
    'detail' in error
  );
}
