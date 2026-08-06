import { Module } from '@nestjs/common';
import { BlogService } from './blog.service.js';
import { BlogController } from './blog.controller.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [AiModule],
  providers: [BlogService],
  controllers: [BlogController],
  exports: [BlogService]
})
export class BlogModule {}
