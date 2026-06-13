import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Root API check',
    description:
      'Returns the scaffold root response to confirm the API is reachable.',
  })
  @ApiOkResponse({ description: 'API root response.', type: String })
  getHello(): string {
    return this.appService.getHello();
  }
}
