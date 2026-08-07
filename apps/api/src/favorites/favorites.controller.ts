import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { AddFavoriteDto, SyncFavoritesDto } from "./favorites.dto.js";
import { FavoritesService } from "./favorites.service.js";

@ApiTags("Favorites")
@ApiStandardErrors()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("favorites")
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated user's favorite requests" })
  async list(@CurrentUserId() userId: string) {
    return { data: await this.favoritesService.list(userId) };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Add a service request to favorites" })
  async add(@CurrentUserId() userId: string, @Body() data: AddFavoriteDto) {
    return { data: await this.favoritesService.add(userId, data) };
  }

  @Put("sync")
  @ApiOperation({ summary: "Merge device-local favorite IDs into the account" })
  async sync(@CurrentUserId() userId: string, @Body() data: SyncFavoritesDto) {
    return { data: await this.favoritesService.sync(userId, data) };
  }

  @Delete(":requestId")
  @ApiOperation({ summary: "Remove a service request from favorites" })
  async remove(
    @CurrentUserId() userId: string,
    @Param("requestId") requestId: string,
  ) {
    return { data: await this.favoritesService.remove(userId, requestId) };
  }
}
