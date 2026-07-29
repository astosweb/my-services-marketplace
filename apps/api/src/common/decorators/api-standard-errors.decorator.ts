import { applyDecorators } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiProperty,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

class ErrorDetailDto {
  @ApiProperty()
  message!: string;

  @ApiProperty({ example: "BAD_REQUEST" })
  code!: string;

  @ApiProperty({ required: false })
  requestId?: string;
}

class ErrorResponseDto {
  @ApiProperty({ type: ErrorDetailDto })
  error!: ErrorDetailDto;
}

export const ApiStandardErrors = () =>
  applyDecorators(
    ApiBadRequestResponse({ type: ErrorResponseDto }),
    ApiUnauthorizedResponse({ type: ErrorResponseDto }),
    ApiForbiddenResponse({ type: ErrorResponseDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto }),
    ApiInternalServerErrorResponse({ type: ErrorResponseDto }),
  );
