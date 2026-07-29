import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  EstonianCity,
  JobProgressStatus,
  OfferStatus,
  RequestPricingMode,
  ServiceRequestStatus,
} from "../generated/prisma/client.js";

export class RequestListQueryDto {
  @ApiPropertyOptional({ enum: EstonianCity })
  @IsOptional()
  @IsEnum(EstonianCity)
  city?: EstonianCity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ServiceRequestStatus, default: ServiceRequestStatus.OPEN })
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;

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

export class MineRequestQueryDto {
  @ApiPropertyOptional({ enum: ["owner", "provider"], default: "owner" })
  @IsOptional()
  @IsIn(["owner", "provider"])
  role: "owner" | "provider" = "owner";

  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 100;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class CreateRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  categoryId!: string;

  @ApiProperty({ minLength: 3, maxLength: 200 })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ minLength: 10, maxLength: 5000 })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ enum: EstonianCity })
  @IsEnum(EstonianCity)
  city!: EstonianCity;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  location!: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  budgetCents?: number;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  budgetLabel?: string;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @ApiPropertyOptional({ enum: RequestPricingMode })
  @IsOptional()
  @IsEnum(RequestPricingMode)
  pricingMode?: RequestPricingMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional({ type: [String], maxItems: 9 })
  @IsOptional()
  @IsArray()
  @MaxLength(500, { each: true })
  photoKeys?: string[];
}

export class CreateOfferDto {
  @ApiPropertyOptional({ nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  priceCents?: number | null;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class UpdateOfferStatusDto {
  @ApiProperty({ enum: [OfferStatus.ACCEPTED, OfferStatus.DECLINED, OfferStatus.WITHDRAWN] })
  @IsIn([OfferStatus.ACCEPTED, OfferStatus.DECLINED, OfferStatus.WITHDRAWN])
  status!: typeof OfferStatus.ACCEPTED | typeof OfferStatus.DECLINED | typeof OfferStatus.WITHDRAWN;
}

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: [ServiceRequestStatus.COMPLETED, ServiceRequestStatus.CANCELLED] })
  @IsIn([ServiceRequestStatus.COMPLETED, ServiceRequestStatus.CANCELLED])
  status!: typeof ServiceRequestStatus.COMPLETED | typeof ServiceRequestStatus.CANCELLED;
}

export class UpdateProgressDto {
  @ApiProperty({
    enum: [
      JobProgressStatus.ON_THE_WAY,
      JobProgressStatus.STARTED,
      JobProgressStatus.PROVIDER_DONE,
    ],
  })
  @IsIn([JobProgressStatus.ON_THE_WAY, JobProgressStatus.STARTED, JobProgressStatus.PROVIDER_DONE])
  status!:
    | typeof JobProgressStatus.ON_THE_WAY
    | typeof JobProgressStatus.STARTED
    | typeof JobProgressStatus.PROVIDER_DONE;
}

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;
}

export class SendRequestMessageDto {
  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}
