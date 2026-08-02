import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class RegisterDeviceDto {
  @ApiProperty({ minLength: 8, maxLength: 512 })
  @IsString()
  @Length(8, 512)
  token!: string;

  @ApiPropertyOptional({ enum: ["ios", "android", "web"], default: "ios" })
  @IsOptional()
  @IsIn(["ios", "android", "web"])
  platform: "ios" | "android" | "web" = "ios";

  @ApiPropertyOptional({ maxLength: 120, description: "Human-readable device name" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ maxLength: 40, description: "OS version e.g. 18.2" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  systemVersion?: string;

  @ApiPropertyOptional({ maxLength: 40, description: "App marketing version" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}
