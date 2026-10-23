/** JSON controller success envelope from 00-integration-basics.md. */
export interface ApiResponse<T> {
  traceId: string;
  code: string;
  /** The API reference marks data as optional and nullable. */
  data?: T | null;
}

/** application/problem+json; bare or non-JSON HTTP failures have no such body. */
export interface ProblemDetails {
  status: number;
  title: string;
  detail: string;
  instance: string;
  traceId: string;
  code: string;
  /** Keys may be property names, model paths, or Identity error codes. */
  errors?: Record<string, string[]>;
}

/** Shared list shape; endpoints returning plain arrays do not use this model. */
export interface ApiPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}
