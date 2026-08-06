import "dotenv/config";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

const API_URL = (process.env.API_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

const owners = [
  { email: "moonika@gobid.test", password: "password123" },
  { email: "raivo@gobid.test", password: "password123" },
  { email: "siiri@gobid.test", password: "password123" },
] as const;

const posts = [
  {
    categoryId: "home_repair",
    title: "Fix loose kitchen cabinet hinges",
    description:
      "Several upper cabinets sag and doors won't close flush. Need hinges adjusted or replaced. Tools welcome.",
    location: "Tallinn, Kristiine",
    latitude: 59.433,
    longitude: 24.715,
    budgetLabel: "€40–70",
    photoSeed: 101,
  },
  {
    categoryId: "plumbing",
    title: "Replace bathroom faucet and shower head",
    description:
      "Old mixer tap leaks at the base. Shower head clogged with limescale. Fixtures already purchased from Bauhof.",
    location: "Tallinn, Kesklinn",
    latitude: 59.437,
    longitude: 24.753,
    budgetLabel: "€50–90",
    photoSeed: 202,
  },
  {
    categoryId: "electrical",
    title: "Add outdoor wall light by entrance",
    description:
      "Need a weatherproof wall lamp installed next to the front door. Cable path is short; breaker panel in basement.",
    location: "Tallinn, Kalamaja",
    latitude: 59.45,
    longitude: 24.73,
    budgetLabel: "€80–130",
    photoSeed: 303,
  },
  {
    categoryId: "cleaning",
    title: "End-of-lease apartment clean",
    description:
      "2-room flat before handover. Kitchen, bathroom, floors, windows. ~48 m². Prefer same-day finish.",
    location: "Tallinn, Mustamäe",
    latitude: 59.4,
    longitude: 24.69,
    budgetLabel: "€90–140",
    photoSeed: 404,
  },
  {
    categoryId: "gardening",
    title: "Mow lawn and edge flower beds",
    description:
      "Small backyard needs mowing and beds cleaned of weeds. About 60 m². Can lend a mower if needed.",
    location: "Tallinn, Nõmme",
    latitude: 59.385,
    longitude: 24.68,
    budgetLabel: "€35–60",
    photoSeed: 505,
  },
  {
    categoryId: "painting",
    title: "Paint bedroom ceiling and one accent wall",
    description:
      "Ceiling ~12 m² plus one feature wall. Paint is ready (Tikkurila). Furniture can be moved aside.",
    location: "Tallinn, Kadriorg",
    latitude: 59.438,
    longitude: 24.79,
    budgetLabel: "€100–160",
    photoSeed: 606,
  },
  {
    categoryId: "hvac",
    title: "Clean and check air conditioner",
    description:
      "Wall-mounted AC unit needs filter clean and coolant check before summer. Unit is Daikin, ~4 years old.",
    location: "Tallinn, Lasnamäe",
    latitude: 59.44,
    longitude: 24.85,
    budgetLabel: "€60–95",
    photoSeed: 707,
  },
  {
    categoryId: "moving",
    title: "Help carry boxes to 4th floor",
    description:
      "About 25 medium boxes from van to apartment. No elevator. Need 2 people for ~90 minutes.",
    location: "Tallinn, Pelgulinn",
    latitude: 59.445,
    longitude: 24.72,
    budgetLabel: "€50–80",
    photoSeed: 808,
  },
  {
    categoryId: "pet_care",
    title: "Dog walking weekday mornings",
    description:
      "Friendly medium mutt needs a 30–40 min walk Mon–Fri around 8:00. Near Pirita beach path.",
    location: "Tallinn, Pirita",
    latitude: 59.47,
    longitude: 24.83,
    budgetLabel: "€15–25 / walk",
    photoSeed: 909,
  },
  {
    categoryId: "handyman",
    title: "Hang curtains and assemble desk",
    description:
      "Drill into concrete for curtain rods in living room + assemble a flat-pack desk. Brackets included.",
    location: "Tallinn, Õismäe",
    latitude: 59.41,
    longitude: 24.65,
    budgetLabel: "€45–75",
    photoSeed: 1010,
  },
] as const;

async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = (await response.json()) as {
    data?: { accessToken: string };
    message?: string;
  };
  if (!response.ok || !json.data?.accessToken) {
    throw new Error(`Login failed for ${email}: ${json.message ?? response.status}`);
  }
  return json.data.accessToken;
}

async function downloadPhoto(seed: number, destPath: string) {
  const response = await fetch(`https://picsum.photos/seed/${seed}/1200/900.jpg`);
  if (!response.ok) throw new Error(`Photo download failed seed=${seed}: ${response.status}`);
  await writeFile(destPath, Buffer.from(await response.arrayBuffer()));
}

async function uploadPhoto(token: string, filePath: string) {
  const buffer = await readFile(filePath);
  const form = new FormData();
  form.append(
    "photos",
    new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }),
    path.basename(filePath),
  );

  const response = await fetch(`${API_URL}/uploads/request-photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = (await response.json()) as {
    data?: { keys: string[] };
    message?: string;
  };
  if (!response.ok || !json.data?.keys?.[0]) {
    throw new Error(`Upload failed: ${json.message ?? response.status}`);
  }
  return json.data.keys[0];
}

async function createRequest(
  token: string,
  post: (typeof posts)[number],
  photoKey: string,
  isPremium: boolean,
) {
  const response = await fetch(`${API_URL}/requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      categoryId: post.categoryId,
      title: post.title,
      description: post.description,
      city: "TALLINN",
      latitude: post.latitude,
      longitude: post.longitude,
      location: post.location,
      budgetLabel: post.budgetLabel,
      pricingMode: "PROVIDER_OFFERS",
      isPremium,
      photoKeys: [photoKey],
    }),
  });
  const json = (await response.json()) as {
    data?: { id: string; title: string; categoryId: string };
    message?: string;
  };
  if (!response.ok || !json.data?.id) {
    throw new Error(`Create failed (${post.title}): ${json.message ?? response.status}`);
  }
  return json.data;
}

async function approveRequest(adminToken: string, id: string) {
  const response = await fetch(`${API_URL}/admin/requests/${id}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ note: "Seeded Tallinn demo post" }),
  });
  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Approve failed for ${id}: ${json.message ?? response.status}`);
  }
}

async function main() {
  const workDir = path.join(tmpdir(), `tallinn-posts-${Date.now()}`);
  await mkdir(workDir, { recursive: true });

  try {
    const ownerTokens = await Promise.all(
      owners.map(async (owner) => login(owner.email, owner.password)),
    );
    const adminToken = await login("admin@gobid.test", "password123");

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]!;
      const token = ownerTokens[i % ownerTokens.length]!;
      const photoPath = path.join(workDir, `${post.categoryId}-${post.photoSeed}.jpg`);

      await downloadPhoto(post.photoSeed, photoPath);
      const photoKey = await uploadPhoto(token, photoPath);
      const created = await createRequest(token, post, photoKey, i % 3 === 0);
      await approveRequest(adminToken, created.id);

      console.info(`✓ ${created.categoryId}: ${created.title} (${created.id})`);
    }

    console.info(`Created and approved ${posts.length} Tallinn posts with photos`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
