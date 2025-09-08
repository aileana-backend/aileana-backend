import { PaginationQueryDto } from '../dto/pagination-query.dto';

/**
 *  Return the pagination metadata for an array of items.
 * @param data  The array of items to paginate
 * @param page  The current page number (1-based index)
 * @param limit  The number of items per page
 * @param totalItems  The total number of items in the dataset
 * @returns  An object containing the paginated data and metadata
 */
export function getPaginationMetadata<T>(
  data: T[],
  page: number,
  limit: number,
  totalItems: number,
) {
  return {
    data,
    metadata: {
      total: totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
      nextPage: page < Math.ceil(totalItems / limit) ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
    },
  };
}

/**
 *  Paginate an array of items, similar to Prisma's pagination.
 * @param array  The array to paginate
 * @param page  The current page number (1-based index)
 * @param limit  The number of items per page
 * @returns  An object containing the paginated data and metadata
 */
export function paginatePrismaArray<T>(
  array: T[],
  page: number,
  limit: number,
) {
  const totalItems = array.length;
  const totalPages = Math.ceil(totalItems / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const paginatedItems = array.slice(startIndex, endIndex);

  return {
    data: paginatedItems,
    meta: {
      total: totalItems,
      page,
      limit,
      totalPages,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
    },
  };
}

/**
 *  Build pagination arguments for database queries.
 * @param PaginationQueryDto  Pagination parameters containing page and limit.
 * @returns  An object with skip and take properties for pagination.
 */
export function buildPaginationArgs(PaginationQueryDto: PaginationQueryDto) {
  const { page, limit } = PaginationQueryDto;

  return {
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' as const },
  };
}
