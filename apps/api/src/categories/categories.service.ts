import { Injectable } from "@nestjs/common";
import { ensureCategoryCatalog } from "../lib/category-catalog.js";
import { serializeCategory } from "../lib/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    await ensureCategoryCatalog(this.prisma);
    return (await this.prisma.category.findMany({ orderBy: { name: "asc" } })).map(
      serializeCategory,
    );
  }
}
