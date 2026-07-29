import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsMimeType, IsOptional, IsString, MaxLength } from "class-validator";

export class ConversationListQueryDto {
  @ApiPropertyOptional({ enum: ["true", "false"] })
  @IsOptional()
  @IsIn(["true", "false"])
  archived?: "true" | "false";
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
