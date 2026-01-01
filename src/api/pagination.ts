export type PaginatedResponse<T> = {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
};

export function toPaginatedResponse<T>(args: {
  docs: T[];
  totalDocs: number;
  limit: number;
  page: number;
}): PaginatedResponse<T> {
  const totalPages = Math.max(1, Math.ceil(args.totalDocs / args.limit));
  const page = Math.max(1, Math.min(args.page, totalPages));
  const hasPrevPage = page > 1;
  const hasNextPage = page < totalPages;
  return {
    docs: args.docs,
    totalDocs: args.totalDocs,
    limit: args.limit,
    totalPages,
    page,
    pagingCounter: (page - 1) * args.limit + 1,
    hasPrevPage,
    hasNextPage,
    prevPage: hasPrevPage ? page - 1 : null,
    nextPage: hasNextPage ? page + 1 : null,
  };
}
