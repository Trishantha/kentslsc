import { Module } from '@nestjs/common';
import { PagesService } from './pages.service.js';
import { PagesController } from './pages.controller.js';

@Module({
  providers: [PagesService],
  controllers: [PagesController]
})
export class PagesModule {}
