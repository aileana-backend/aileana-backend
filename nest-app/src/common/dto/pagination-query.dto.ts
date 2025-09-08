import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiProperty({
    required: false,
    default: 1,
    description: 'The page number to retrieve',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be a positive number.' })
  @Min(1, { message: 'Page must be a positive number.' })
  page: number = 1;

  @ApiProperty({
    required: false,
    default: 20,
    description: 'The number of items to retrieve per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be a positive number.' })
  @Min(1, { message: 'Limit must be a positive number.' })
  limit: number = 20;
}
