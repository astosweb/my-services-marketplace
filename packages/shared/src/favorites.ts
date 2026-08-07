import { z } from "zod";
import type { MarketplaceRequest } from "./public";

export type FavoriteDto = {
  id: string;
  requestId: string;
  createdAt: string;
  request: MarketplaceRequest;
};

export type FavoritesListResponse = {
  ids: string[];
  items: FavoriteDto[];
};

export const addFavoriteSchema = z.object({
  requestId: z.string().min(1),
});

export type AddFavoriteInput = z.infer<typeof addFavoriteSchema>;

export const syncFavoritesSchema = z.object({
  requestIds: z.array(z.string().min(1)).max(100),
});

export type SyncFavoritesInput = z.infer<typeof syncFavoritesSchema>;
