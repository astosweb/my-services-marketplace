import type { PrismaClient } from "../generated/prisma/client.js";

export const categoryCatalog = [
  { id: "home_repair", name: "Home Repair", symbol: "hammer.fill" },
  { id: "plumbing", name: "Plumbing", symbol: "drop.fill" },
  { id: "electrical", name: "Electrical", symbol: "bolt.fill" },
  { id: "cleaning", name: "Cleaning", symbol: "sparkles" },
  { id: "gardening", name: "Gardening", symbol: "leaf.fill" },
  { id: "painting", name: "Painting", symbol: "paintbrush.fill" },
  { id: "hvac", name: "HVAC", symbol: "wind" },
  { id: "moving", name: "Moving", symbol: "shippingbox.fill" },
  { id: "pet_care", name: "Pet Care", symbol: "pawprint.fill" },
  { id: "beauty", name: "Beauty", symbol: "scissors" },
  { id: "handyman", name: "Handyman", symbol: "screwdriver.fill" },
  { id: "automotive", name: "Automotive", symbol: "car.fill" },
  { id: "designated_driver", name: "Designated driver", symbol: "steeringwheel" },
  { id: "carpool", name: "Carpool", symbol: "person.2.fill" },
] as const;

let categoryCatalogSync: Promise<void> | undefined;

async function syncCategoryCatalog(prisma: PrismaClient) {
  await Promise.all(
    categoryCatalog.map((category) =>
      prisma.category.upsert({
        where: { id: category.id },
        create: category,
        update: { name: category.name, symbol: category.symbol },
      }),
    ),
  );
}

export function ensureCategoryCatalog(prisma: PrismaClient) {
  categoryCatalogSync ??= syncCategoryCatalog(prisma).catch((error: unknown) => {
    categoryCatalogSync = undefined;
    throw error;
  });
  return categoryCatalogSync;
}
