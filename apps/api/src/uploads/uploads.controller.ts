import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiStandardErrors } from "../common/decorators/api-standard-errors.decorator.js";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator.js";
import { Public } from "../common/decorators/public.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { badRequest } from "../lib/errors.js";
import type { UploadFile } from "../lib/storage.js";
import { UploadsService } from "./uploads.service.js";

@ApiTags("Uploads")
@ApiStandardErrors()
@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("request-photos")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor("photos", 9, { limits: { fileSize: 8 * 1024 * 1024 } }))
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["photos"],
      properties: { photos: { type: "array", items: { type: "string", format: "binary" } } },
    },
  })
  @ApiOperation({ summary: "Upload up to nine request photos" })
  async requestPhotos(
    @CurrentUserId() userId: string,
    @UploadedFiles() files: UploadFile[] | undefined,
  ) {
    if (!files?.length) throw badRequest('Include at least one image in the "photos" field');
    return {
      data: {
        keys: await this.uploadsService.requestPhotos(userId, files),
      },
    };
  }

  @Post("message-attachments")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024 } }))
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiOperation({ summary: "Upload a private message attachment" })
  async messageAttachment(
    @CurrentUserId() userId: string,
    @UploadedFile() file: UploadFile | undefined,
  ) {
    if (!file) throw badRequest('Include a file in the "file" field');
    return {
      data: await this.uploadsService.messageAttachment(userId, file),
    };
  }

  @Post("support-attachments")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor("files", 9, { limits: { fileSize: 15 * 1024 * 1024 } }))
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["files"],
      properties: { files: { type: "array", items: { type: "string", format: "binary" } } },
    },
  })
  @ApiOperation({ summary: "Upload support ticket attachments (images/documents)" })
  async supportAttachments(
    @CurrentUserId() userId: string,
    @UploadedFiles() files: UploadFile[] | undefined,
  ) {
    if (!files?.length) throw badRequest('Include at least one file in the "files" field');
    const uploaded = [];
    for (const file of files) {
      uploaded.push(await this.uploadsService.supportAttachment(userId, file));
    }
    return { data: { files: uploaded } };
  }

  @Post("avatars")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "file", maxCount: 1 },
        { name: "avatar", maxCount: 1 },
      ],
      { limits: { fileSize: 8 * 1024 * 1024 } },
    ),
  )
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload a profile avatar" })
  async avatar(
    @CurrentUserId() userId: string,
    @UploadedFiles()
    files: { file?: UploadFile[]; avatar?: UploadFile[] } | undefined,
  ) {
    const file = files?.file?.[0] ?? files?.avatar?.[0];
    if (!file) throw badRequest('Include an image in the "file" field');
    return { data: await this.uploadsService.avatar(userId, file) };
  }

  @Get("*key")
  @Public()
  @ApiOperation({ summary: "Read a public or authorized private upload" })
  async read(
    @Param("key") pathSegments: string | string[],
    @Query("token") token: string | undefined,
    @Query("exp") expires: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const encodedKey = Array.isArray(pathSegments) ? pathSegments.join("/") : pathSegments;
    if (!encodedKey) throw badRequest("File key is required");
    const object = await this.uploadsService.read(
      encodedKey,
      token,
      expires,
      request.header("authorization"),
    );
    response.setHeader("Content-Type", object.contentType);
    if (!object.contentType.startsWith("image/")) {
      response.setHeader("Content-Disposition", "attachment");
    }
    response.setHeader(
      "Cache-Control",
      object.private ? "private, max-age=60" : "public, max-age=86400",
    );
    return new StreamableFile(object.data);
  }
}
