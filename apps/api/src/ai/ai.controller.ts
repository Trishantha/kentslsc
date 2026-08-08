import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { Public } from '../common/decorators/public.decorator.js';
import { AiRecommendDto } from './dto/ai-recommend.dto.js';
import { AiSearchDto } from './dto/ai-search.dto.js';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('summarise')
  @UseGuards(JwtAuthGuard)
  async summarise(@Body() body: { content: string; type: string; maxLength?: number }) {
    return { summary: await this.aiService.summarise(body.content, body.type, body.maxLength) };
  }

  @Post('moderate')
  @UseGuards(JwtAuthGuard)
  async moderate(@Body() body: { content: string }) {
    return this.aiService.moderate(body.content);
  }

  @Post('recommend')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 } })
  async recommend(@Body() dto: AiRecommendDto) {
    return { items: await this.aiService.recommend(dto) };
  }

  @Post('search')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 } })
  async search(@Body() dto: AiSearchDto) {
    return { results: await this.aiService.search(dto) };
  }
}
