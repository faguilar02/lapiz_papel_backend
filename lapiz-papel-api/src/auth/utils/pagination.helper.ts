import { PaginatedResponse } from '../interfaces/paginated-response.interface';

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return {
    data,
    total,
    totalPages,
    currentPage,
  };
}
