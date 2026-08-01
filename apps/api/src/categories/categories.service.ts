import { Injectable, type OnModuleInit } from "@nestjs/common";
import { ensureCategoryCatalog } from "../lib/category-catalog.js";
import { serializeCategory } from "../lib/serializers.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await ensureCategoryCatalog(this.prisma);
  }

  async list() {
    return (await this.prisma.category.findMany({ orderBy: { name: "asc" } })).map(
      serializeCategory,
    );
  }
}
