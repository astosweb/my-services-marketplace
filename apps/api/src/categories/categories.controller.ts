import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { Public } from "../common/decorators/public.decorator.js";
import { CategoriesService } from "./categories.service.js";

@ApiTags("Categories")
@ApiStandardErrors()
@Public()
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: "List service categories" })
  @ApiOkResponse({ description: "Category catalog sorted by name" })
  async list() {
    return { data: await this.categoriesService.list() };
  }
}
