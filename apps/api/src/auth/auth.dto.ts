import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, writeOnly: true })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  displayName!: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ writeOnly: true })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, writeOnly: true })
  @IsString()
  @Length(8, 128)
  password!: string;
}

class ProfileFieldsDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  displayName!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessName!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  preferBusinessName!: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  avatarKey!: string | null;
}

export class UpdateProfileDto extends PartialType(ProfileFieldsDto) {}

export class DeleteAccountDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
