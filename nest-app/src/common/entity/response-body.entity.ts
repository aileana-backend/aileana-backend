import { ApiProperty } from '@nestjs/swagger';

export class ResponseBody<T = any> {
  @ApiProperty({
    description: 'Response data',
  })
  data: T | null;

  @ApiProperty({
    description: 'Response message',
    example: 'Request was successful',
  })
  message: string;

  @ApiProperty({
    description: 'Response status',
    example: true,
  })
  status: boolean;
}

export class PaginationMetadata {
  @ApiProperty({
    description:
      'Total records on the database with respect to the request query.',
    example: 10,
  })
  total: number;

  @ApiProperty({ description: 'The current viewing page.', example: 1 })
  page: number;

  @ApiProperty({
    description: 'The page limit, max number of records to return',
    example: 50,
  })
  limit: number;

  @ApiProperty({
    description:
      'This is the total pages in the database with respect to the query.',
    example: 4,
  })
  totalPages: number;

  @ApiProperty({ description: 'The next page to fetch from.', example: 2 })
  nextPage: number | null;

  @ApiProperty({ description: 'The previous page', example: 1 })
  previousPage: number | null;
}
export class PaginationResponseBody<T = any> extends ResponseBody<T[]> {
  @ApiProperty({
    description:
      'The pagination metadata for implementing paginated content loading.',
    type: PaginationMetadata,
  })
  metadata: PaginationMetadata;
}

export class PaginateResponseBody<D = any> {
  @ApiProperty({
    description: 'The list of items in the current page',
  })
  data: D[];

  @ApiProperty({
    description:
      'The pagination metadata for implementing paginated content loading.',
    type: PaginationMetadata,
  })
  metadata: PaginationMetadata;
}
