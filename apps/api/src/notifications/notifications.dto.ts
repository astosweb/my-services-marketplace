import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class NotificationListQueryDto {
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

export class MarkNotificationReadDto {
  @ApiProperty({ enum: [true] })
  @Equals(true)
  isRead!: true;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    type: [String],
    description: "Up to 3 category ids the user wants push notifications for",
    maxItems: 3,
    example: ["plumbing", "cleaning", "moving"],
  })
  @IsArray()
  @ArrayMaxSize(3, { message: "You can select at most 3 notification categories" })
  @ArrayUnique()
  @IsString({ each: true })
  categoryIds!: string[];
}
