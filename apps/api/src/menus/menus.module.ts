import { Module } from '@nestjs/common';
import { MenusService } from './menus.service.js';
import { MenusController } from './menus.controller.js';

@Module({
  providers: [MenusService],
  controllers: [MenusController]
})
export class MenusModule {}
