export type ApiFieldError = {
  field?: string;
  path?: string;
  message: string;
};

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = {
  success: false;
  error: string;
  errors?: ApiFieldError[];
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type NestSuccess<T> = { data: T; meta?: PaginationMeta };
export type NestError = {
  error: { message: string; code: string; requestId?: string };
};

export type PaginationMeta = {
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  unreadCount?: number;
};

export type Paginated<T> = {
  items: T[];
  meta: PaginationMeta;
};
