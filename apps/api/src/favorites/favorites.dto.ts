import { IsArray, IsString, ArrayMaxSize, ArrayUnique } from "class-validator";

export class AddFavoriteDto {
  @IsString()
  requestId!: string;
}

export class SyncFavoritesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  requestIds!: string[];
}
