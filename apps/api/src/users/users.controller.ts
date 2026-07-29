import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UpdateProfileDto } from "../auth/auth.dto.js";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { UsersService } from "./users.service.js";

@ApiTags("Users")
@ApiStandardErrors()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(":id/reviews")
  @ApiOperation({ summary: "List reviews received by a user" })
  async reviews(@Param("id") id: string) {
    return { data: await this.usersService.reviews(id) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a public user profile" })
  async get(@Param("id") id: string) {
    return { data: await this.usersService.get(id) };
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update your own user profile" })
  async update(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() data: UpdateProfileDto,
  ) {
    return { data: await this.usersService.update(id, userId, data) };
  }
}
