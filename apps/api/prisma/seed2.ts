import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { EstonianCity, PrismaClient } from "../src/generated/prisma/client.js";
import { categoryCatalog } from "../src/lib/category-catalog.js";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
  console.error("Refusing to seed: NODE_ENV=production (set ALLOW_SEED=true to override).");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required to seed.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
    ...(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false"
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  }),
});

const seedRequests = [
  {
    id: "seed2_req_gardening",
    ownerId: "seed_user_moonika",
    categoryId: "gardening",
    title: "Trim hedges and clear fallen leaves",
    description:
      "Front yard hedges need a good trim, and leaves have piled up after last week's storm. About 40 m² garden.",
    city: EstonianCity.TALLINN,
    latitude: 59.433,
    longitude: 24.75,
    location: "Tallinn, Kesklinn",
    budgetLabel: "€50–80",
    isPremium: false,
    viewCount: 7,
  },
  {
    id: "seed2_req_painting",
    ownerId: "seed_user_raivo",
    categoryId: "painting",
    title: "Paint living room and hallway",
    description:
      "Walls already patched. Need two coats of white matte. Living room ~20 m² + hallway. Paint provided.",
    city: EstonianCity.TALLINN,
    latitude: 59.437,
    longitude: 24.753,
    location: "Tallinn, Kalamaja",
    budgetLabel: "€120–180",
    isPremium: true,
    viewCount: 15,
  },
  {
    id: "seed2_req_moving",
    ownerId: "seed_user_siiri",
    categoryId: "moving",
    title: "Help moving sofa and wardrobe upstairs",
    description:
      "Moving a 3-seater sofa and a wardrobe from ground floor to 3rd floor. No elevator. Need 2 strong people.",
    city: EstonianCity.TARTU,
    latitude: 58.378,
    longitude: 26.729,
    location: "Tallinn, Kesklinn",
    budgetLabel: "€60–90",
    isPremium: false,
    viewCount: 11,
  },
  {
    id: "seed2_req_hvac",
    ownerId: "seed_user_moonika",
    categoryId: "hvac",
    title: "Service heat pump before winter",
    description:
      "Air-to-air heat pump needs cleaning and check before cold season. Unit is ~5 years old, Mitsubishi.",
    city: EstonianCity.TALLINN,
    latitude: 59.422,
    longitude: 24.8,
    location: "Tallinn, Lasnamäe",
    budgetLabel: "€70–100",
    isPremium: false,
    viewCount: 9,
  },
  {
    id: "seed2_req_handyman",
    ownerId: "seed_user_raivo",
    categoryId: "handyman",
    title: "Mount TV and assemble IKEA shelves",
    description:
      "55\" TV wall mount (bracket ready) + two Billy bookcases to assemble. Concrete walls.",
    city: EstonianCity.PARNU,
    latitude: 58.385,
    longitude: 24.497,
    location: "Tallinn, Kesklinn",
    budgetLabel: "€40–70",
    isPremium: false,
    viewCount: 5,
  },
] as const;

async function main() {
  for (const category of categoryCatalog) {
    await prisma.category.upsert({
      where: { id: category.id },
      create: category,
      update: { name: category.name, symbol: category.symbol },
    });
  }

  const ownerIds = [...new Set(seedRequests.map((r) => r.ownerId))];
  const existingOwners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true },
  });
  const missing = ownerIds.filter((id) => !existingOwners.some((u) => u.id === id));
  if (missing.length > 0) {
    console.error(
      `Missing seed users: ${missing.join(", ")}. Run \`pnpm db:seed\` first.`,
    );
    process.exit(1);
  }

  for (const request of seedRequests) {
    await prisma.serviceRequest.upsert({
      where: { id: request.id },
      create: request,
      update: {
        title: request.title,
        description: request.description,
        location: request.location,
        budgetLabel: request.budgetLabel,
        isPremium: request.isPremium,
        viewCount: request.viewCount,
        latitude: request.latitude,
        longitude: request.longitude,
        city: request.city,
        categoryId: request.categoryId,
      },
    });
  }

  console.info(`Seeded ${seedRequests.length} requests (seed2)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
