export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export function paginationParams(input: PaginationInput) {
  const page = input.page ?? 1;
  const pageSize = Math.min(input.pageSize ?? 20, 100);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function paginatedResponse<T>(
  data: T[],
  pagination: { page: number; pageSize: number; totalItems: number },
) {
  return {
    data,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: pagination.totalItems,
      totalPages: Math.ceil(pagination.totalItems / pagination.pageSize),
    },
  };
}
