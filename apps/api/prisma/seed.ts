import { PrismaPg } from "@prisma/adapter-pg";
import {
  EstonianCity,
  JobProgressStatus,
  OfferStatus,
  PrismaClient,
  ServiceRequestStatus,
  UserRole,
} from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/lib/auth.js";
import { categoryCatalog } from "../src/lib/category-catalog.js";
import { databaseSslOptions } from "../src/lib/database-ssl.js";

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
    ...databaseSslOptions(databaseUrl),
  }),
});

const seedUsers = [
  {
    id: "seed_user_moonika",
    email: "moonika@hero.test",
    displayName: "Moonika Tamm",
    bio: "Renting in Kristiine. Handy with most things but plumbing is a mystery to me.",
    rating: 4.2,
    reviewCount: 8,
  },
  {
    id: "seed_user_raivo",
    email: "raivo@hero.test",
    displayName: "Raivo Kaljurand",
    bio: "Just moved into a new place in Kalamaja. Looking for reliable tradespeople.",
    rating: 4.8,
    reviewCount: 24,
  },
  {
    id: "seed_user_siiri",
    email: "siiri@hero.test",
    displayName: "Siiri Leppänen",
    bio: "Student living in Annelinn. Recently renovated my flat and need it spotless.",
    rating: 4.5,
    reviewCount: 12,
  },
] as const;

const seedRequests = [
  {
    id: "seed_req_plumbing",
    ownerId: "seed_user_moonika",
    categoryId: "plumbing",
    title: "Leaking pipe under kitchen sink",
    description:
      "Water dripping from the U-bend, needs replacing or sealing. Preferably done today.",
    city: EstonianCity.TALLINN,
    latitude: 59.449,
    longitude: 24.7356,
    location: "Tallinn, Kristiine",
    budgetLabel: "€30–60",
    isPremium: false,
    viewCount: 18,
  },
  {
    id: "seed_req_electrical",
    ownerId: "seed_user_raivo",
    categoryId: "electrical",
    title: "Install 3 ceiling light fixtures",
    description:
      "New apartment, wiring is ready. Need an electrician to mount and connect three pendant lights.",
    city: EstonianCity.TALLINN,
    latitude: 59.4462,
    longitude: 24.6975,
    location: "Tallinn, Põhja-Tallinn",
    budgetLabel: "€80–120",
    isPremium: true,
    viewCount: 42,
  },
  {
    id: "seed_req_cleaning",
    ownerId: "seed_user_siiri",
    categoryId: "cleaning",
    title: "Post-renovation deep clean",
    description: "3-room apartment after renovation. Dust, paint spots everywhere. ~65 m².",
    city: EstonianCity.TARTU,
    latitude: 58.371,
    longitude: 26.72,
    location: "Tartu, Annelinn",
    budgetLabel: "€100–150",
    isPremium: false,
    viewCount: 25,
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

  const passwordHash = await hashPassword("password123");

  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: { ...user, passwordHash, role: UserRole.USER },
      update: {
        displayName: user.displayName,
        bio: user.bio,
        rating: user.rating,
        reviewCount: user.reviewCount,
        passwordHash,
      },
    });
  }

  await prisma.user.upsert({
    where: { id: "seed_user_admin" },
    create: {
      id: "seed_user_admin",
      email: "admin@hero.test",
      displayName: "Bidy Admin",
      bio: "Marketplace operations admin",
      role: UserRole.ADMIN,
      passwordHash,
    },
    update: {
      displayName: "Bidy Admin",
      bio: "Marketplace operations admin",
      role: UserRole.ADMIN,
      passwordHash,
    },
  });

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
      },
    });
  }

  await prisma.serviceRequest.update({
    where: { id: "seed_req_electrical" },
    data: {
      status: ServiceRequestStatus.IN_PROGRESS,
      progressStatus: JobProgressStatus.STARTED,
      progressUpdatedAt: new Date(),
    },
  });

  const electricalProgressAt = new Date();
  await prisma.jobProgressEvent.deleteMany({ where: { requestId: "seed_req_electrical" } });
  await prisma.jobProgressEvent.createMany({
    data: [
      {
        requestId: "seed_req_electrical",
        status: JobProgressStatus.ACCEPTED,
        createdAt: new Date(electricalProgressAt.getTime() - 3 * 60 * 60 * 1000),
      },
      {
        requestId: "seed_req_electrical",
        status: JobProgressStatus.ON_THE_WAY,
        createdAt: new Date(electricalProgressAt.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        requestId: "seed_req_electrical",
        status: JobProgressStatus.STARTED,
        createdAt: electricalProgressAt,
      },
    ],
  });

  await prisma.offer.upsert({
    where: { id: "seed_offer_electrical_moonika" },
    create: {
      id: "seed_offer_electrical_moonika",
      requestId: "seed_req_electrical",
      offererId: "seed_user_moonika",
      priceCents: 11000,
      message: "I can bring fittings and handle all three lights this afternoon.",
      status: OfferStatus.ACCEPTED,
    },
    update: {
      priceCents: 11000,
      message: "I can bring fittings and handle all three lights this afternoon.",
      status: OfferStatus.ACCEPTED,
    },
  });

  console.info(
    `Seeded ${categoryCatalog.length} categories, ${seedUsers.length + 1} users, ${seedRequests.length} requests`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
