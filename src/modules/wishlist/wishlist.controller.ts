import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponse } from '../../common/swagger/api-response.models';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { WishlistService } from './wishlist.service';

const SESSION_TOKEN_HEADER = {
  name: 'X-Session-Token',
  description:
    'Anonymous session token returned by POST /quiz/profiles. Identifies the ' +
    'owning session; the wishlist is always scoped to it.',
  required: true,
} as const;

@ApiTags('Wishlist')
@ApiHeader(SESSION_TOKEN_HEADER)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Post('items')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Save a Product or Pack to the wishlist',
    description:
      'Adds an active, public Product or an active, public Pack to the ' +
      "session's wishlist. The owning session is taken from the X-Session-Token " +
      'header. The operation is idempotent: re-adding the same target returns the ' +
      'existing entry with `created: false` rather than erroring. Only PRODUCT and ' +
      'PACK targets are supported (PackConfiguration is not saveable yet).',
  })
  @ApiOkResponse({
    description:
      'The saved wishlist item plus a `created` flag (false when it already ' +
      'existed).',
  })
  @ApiBadRequestResponse({
    description: 'Missing session token or invalid request body.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({
    description:
      'Session not found, or the target Product/Pack does not exist or is not ' +
      'active/public.',
    type: ApiErrorResponse,
  })
  addItem(
    @Headers('x-session-token') sessionToken: string,
    @Body() dto: AddWishlistItemDto,
  ) {
    return this.wishlistService.addItem(sessionToken, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List the session wishlist',
    description:
      'Returns the wishlist for the session identified by X-Session-Token, as ' +
      'customer-safe Product and Pack summaries only. A session can only ever ' +
      'read its own wishlist.',
  })
  @ApiOkResponse({ description: 'The wishlist items for the session.' })
  @ApiBadRequestResponse({
    description: 'Missing session token.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({
    description: 'Session not found.',
    type: ApiErrorResponse,
  })
  list(@Headers('x-session-token') sessionToken: string) {
    return this.wishlistService.list(sessionToken);
  }

  @Delete('items/:itemId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Remove an item from the wishlist',
    description:
      'Removes a wishlist item owned by the session identified by ' +
      'X-Session-Token. Removing an item that does not belong to the session ' +
      'returns 404 (a session can never remove another owner’s item).',
  })
  @ApiParam({ name: 'itemId', description: 'Wishlist item ID to remove.' })
  @ApiOkResponse({ description: 'The item was removed.' })
  @ApiBadRequestResponse({
    description: 'Missing session token.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({
    description: 'Session not found, or the item does not belong to the session.',
    type: ApiErrorResponse,
  })
  removeItem(
    @Headers('x-session-token') sessionToken: string,
    @Param('itemId') itemId: string,
  ) {
    return this.wishlistService.removeItem(sessionToken, itemId);
  }
}
