import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import { AiRecommendDto } from './dto/ai-recommend.dto.js';
import { AiSearchDto } from './dto/ai-search.dto.js';
import { AiSummariseDto } from './dto/ai-summarise.dto.js';
import { AiModerateDto } from './dto/ai-moderate.dto.js';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('summarise')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async summarise(@Body() dto: AiSummariseDto) {
    return { summary: await this.aiService.summarise(dto.content, dto.type, dto.maxLength) };
  }

  @Post('moderate')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async moderate(@Body() dto: AiModerateDto) {
    return this.aiService.moderate(dto.content);
  }

  @Post('recommend')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async recommend(@Body() dto: AiRecommendDto) {
    return { items: await this.aiService.recommend(dto) };
  }

  @Post('search')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async search(@Body() dto: AiSearchDto) {
    return { results: await this.aiService.search(dto) };
  }
}
