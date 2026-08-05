import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMimeType,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class ConversationListQueryDto {
  @ApiPropertyOptional({ enum: ["true", "false"] })
  @IsOptional()
  @IsIn(["true", "false"])
  archived?: "true" | "false";

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

export class UpdateArchiveDto {
  @ApiProperty()
  @IsBoolean()
  isArchived!: boolean;
}

export class UpdatePinDto {
  @ApiProperty()
  @IsBoolean()
  isPinned!: boolean;
}

export class SendConversationMessageDto {
  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachmentKey?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  attachmentName?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsMimeType()
  @MaxLength(100)
  attachmentMimeType?: string;
}
