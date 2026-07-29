import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Length } from "class-validator";

export class RegisterDeviceDto {
  @ApiProperty({ minLength: 8, maxLength: 512 })
  @IsString()
  @Length(8, 512)
  token!: string;

  @ApiPropertyOptional({ enum: ["ios", "android", "web"], default: "ios" })
  @IsOptional()
  @IsIn(["ios", "android", "web"])
  platform: "ios" | "android" | "web" = "ios";
}
