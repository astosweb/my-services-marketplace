import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator.js";
import { Public } from "../common/decorators/public.decorator.js";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { ViewRateLimit } from "../middleware/rate-limit.js";
import {
  CreateOfferDto,
  CreateRequestDto,
  CreateReviewDto,
  MineRequestQueryDto,
  OpenConversationDto,
  RequestConversationQueryDto,
  RequestListQueryDto,
  SendRequestMessageDto,
  UpdateOfferStatusDto,
  UpdateProgressDto,
  UpdateRequestStatusDto,
} from "./requests.dto.js";
import { RequestsService } from "./requests.service.js";

@ApiTags("Requests")
@ApiStandardErrors()
@Controller("requests")
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: "List service requests" })
  list(@Query() query: RequestListQueryDto) {
    return this.requestsService.list(query);
  }

  @Get("mine")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the authenticated user's requests or jobs" })
  mine(@CurrentUserId() userId: string, @Query() query: MineRequestQueryDto) {
    return this.requestsService.mine(userId, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a service request" })
  async create(@CurrentUserId() userId: string, @Body() data: CreateRequestDto) {
    return { data: await this.requestsService.create(userId, data) };
  }

  @Get(":id")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a service request" })
  async get(@Param("id") id: string, @CurrentUserId() userId: string | undefined) {
    return { data: await this.requestsService.get(id, userId) };
  }

  @Post(":id/views")
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @ViewRateLimit()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Record a request view" })
  async view(@Param("id") id: string, @CurrentUserId() userId: string | undefined) {
    return { data: await this.requestsService.view(id, userId) };
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Replace an open request" })
  async update(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() data: CreateRequestDto,
  ) {
    return { data: await this.requestsService.update(id, userId, data) };
  }

  @Get(":id/offers")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List offers for an owned request" })
  async offers(@Param("id") id: string, @CurrentUserId() userId: string) {
    return { data: await this.requestsService.offers(id, userId) };
  }

  @Post(":id/offers")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create an offer or express interest" })
  async createOffer(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() data: CreateOfferDto,
  ) {
    return { data: await this.requestsService.createOffer(id, userId, data) };
  }

  @Patch(":id/offers/:offerId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Accept, decline, or withdraw an offer" })
  async updateOffer(
    @Param("id") id: string,
    @Param("offerId") offerId: string,
    @CurrentUserId() userId: string,
    @Body() data: UpdateOfferStatusDto,
  ) {
    return {
      data: await this.requestsService.updateOffer(id, offerId, userId, data),
    };
  }

  @Patch(":id/status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Complete or cancel an owned request" })
  async updateStatus(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() data: UpdateRequestStatusDto,
  ) {
    return { data: await this.requestsService.updateStatus(id, userId, data) };
  }

  @Patch(":id/progress")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Advance accepted-provider job progress" })
  async updateProgress(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() data: UpdateProgressDto,
  ) {
    return { data: await this.requestsService.updateProgress(id, userId, data) };
  }

  @Post(":id/reviews")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Review the other participant in a completed job" })
  async review(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() data: CreateReviewDto,
  ) {
    return { data: await this.requestsService.review(id, userId, data) };
  }

  @Get(":id/conversation")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the user's conversation for a request" })
  async conversation(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Query() query: RequestConversationQueryDto,
  ) {
    return { data: await this.requestsService.conversation(id, userId, query.peerUserId) };
  }

  @Post(":id/conversation")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Open an authorized request conversation" })
  async openConversation(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Query() query: RequestConversationQueryDto,
    @Body() data?: OpenConversationDto,
  ) {
    return {
      data: await this.requestsService.openConversation(
        id,
        userId,
        data?.peerUserId ?? query.peerUserId,
      ),
    };
  }

  @Post(":id/messages")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Send a legacy request-scoped message",
    deprecated: true,
    description: "Prefer POST /conversations/:id/messages",
  })
  async sendMessage(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() data: SendRequestMessageDto,
  ) {
    return { data: await this.requestsService.sendMessage(id, userId, data) };
  }
}
