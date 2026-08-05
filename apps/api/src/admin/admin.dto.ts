import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
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
  OfferStatus,
  ServiceRequestStatus,
  UserRole,
} from "../generated/prisma/client.js";

export class AdminPaginationQueryDto {
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

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder: "asc" | "desc" = "desc";
}

const userSortFields = ["createdAt", "displayName", "email", "rating", "reviewCount"] as const;

export class AdminUsersQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: ["ACTIVE", "BANNED"] })
  @IsOptional()
  @IsIn(["ACTIVE", "BANNED"])
  status?: "ACTIVE" | "BANNED";

  @ApiPropertyOptional({ enum: userSortFields, default: "createdAt" })
  @IsOptional()
  @IsIn(userSortFields)
  sortBy: string = "createdAt";
}

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  businessName?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: ["ACTIVE", "BANNED"] })
  @IsOptional()
  @IsIn(["ACTIVE", "BANNED"])
  status?: "ACTIVE" | "BANNED";
}

export class AdminBulkUsersDto {
  @ApiProperty({ type: [String], maxItems: 100 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids!: string[];

  @ApiProperty({ enum: ["delete", "ban", "unban"] })
  @IsIn(["delete", "ban", "unban"])
  action!: "delete" | "ban" | "unban";
}

const requestSortFields = ["createdAt", "updatedAt", "title", "viewCount", "budgetCents"] as const;

export class AdminRequestsQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ enum: ServiceRequestStatus })
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;

  @ApiPropertyOptional({ enum: EstonianCity })
  @IsOptional()
  @IsEnum(EstonianCity)
  city?: EstonianCity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional({ enum: requestSortFields, default: "createdAt" })
  @IsOptional()
  @IsIn(requestSortFields)
  sortBy: string = "createdAt";
}

export class AdminCreateRequestDto {
  @ApiProperty({ description: "ID of the user creating the request" })
  @IsString()
  @MinLength(1)
  ownerId!: string;

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

  @ApiProperty()
  @IsString()
  @MinLength(1)
  location!: string;

  @ApiPropertyOptional({ minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetLabel?: string;

  @ApiPropertyOptional({ enum: ["PROVIDER_OFFERS", "OWNER_FIXED_PRICE"] })
  @IsOptional()
  @IsIn(["PROVIDER_OFFERS", "OWNER_FIXED_PRICE"])
  pricingMode?: "PROVIDER_OFFERS" | "OWNER_FIXED_PRICE";

  @ApiPropertyOptional({ enum: ServiceRequestStatus })
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class AdminUpdateRequestDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ minLength: 10, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: EstonianCity })
  @IsOptional()
  @IsEnum(EstonianCity)
  city?: EstonianCity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  budgetCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetLabel?: string;

  @ApiPropertyOptional({ enum: ["PROVIDER_OFFERS", "OWNER_FIXED_PRICE"] })
  @IsOptional()
  @IsIn(["PROVIDER_OFFERS", "OWNER_FIXED_PRICE"])
  pricingMode?: "PROVIDER_OFFERS" | "OWNER_FIXED_PRICE";

  @ApiPropertyOptional({ enum: ServiceRequestStatus })
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class AdminApproveRequestDto {
  @ApiPropertyOptional({ description: "Optional moderation note for approval" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class AdminRejectRequestDto {
  @ApiProperty({ description: "Rejection reason provided by admin" })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

const offerSortFields = ["createdAt", "updatedAt", "priceCents"] as const;

export class AdminOffersQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ enum: OfferStatus })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ enum: offerSortFields, default: "createdAt" })
  @IsOptional()
  @IsIn(offerSortFields)
  sortBy: string = "createdAt";
}

export class AdminUpdateOfferDto {
  @ApiProperty({ enum: OfferStatus })
  @IsEnum(OfferStatus)
  status!: OfferStatus;
}

const reviewSortFields = ["createdAt", "rating"] as const;

export class AdminReviewsQueryDto extends AdminPaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter by reviewed user id" })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ enum: reviewSortFields, default: "createdAt" })
  @IsOptional()
  @IsIn(reviewSortFields)
  sortBy: string = "createdAt";
}

export class AdminConversationsQueryDto extends AdminPaginationQueryDto {}
