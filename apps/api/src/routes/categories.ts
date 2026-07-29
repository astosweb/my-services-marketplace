import { Hono } from "hono";
import { ensureCategoryCatalog } from "../lib/category-catalog.js";
import { prisma } from "../lib/prisma.js";
import { serializeCategory } from "../lib/serializers.js";

export const categoryRoutes = new Hono();

categoryRoutes.get("/", async (c) => {
  await ensureCategoryCatalog(prisma);
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  return c.json({ data: categories.map(serializeCategory) });
});
