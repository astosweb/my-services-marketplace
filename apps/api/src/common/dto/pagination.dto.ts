import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

/** Shared offset/limit pagination fields. Subclass or compose for module defaults. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class MessagesQueryDto {
  @ApiPropertyOptional({
    default: 100,
    minimum: 1,
    maximum: 200,
    description: "Max messages to return (most recent when using before cursor)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 100;

  @ApiPropertyOptional({
    description: "Return messages created before this ISO timestamp (cursor pagination)",
  })
  @IsOptional()
  before?: string;
}
