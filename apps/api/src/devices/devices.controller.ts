import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RegisterDeviceDto } from "./devices.dto.js";
import { DevicesService } from "./devices.service.js";

@ApiTags("Devices")
@ApiStandardErrors()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("devices")
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Register a push notification device token" })
  async register(@CurrentUserId() userId: string, @Body() data: RegisterDeviceDto) {
    return { data: await this.devicesService.register(userId, data) };
  }

  @Delete(":token")
  @ApiOperation({ summary: "Remove a push notification device token" })
  async remove(@CurrentUserId() userId: string, @Param("token") token: string) {
    return { data: await this.devicesService.remove(userId, token) };
  }
}
