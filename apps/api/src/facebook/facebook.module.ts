import { Module } from '@nestjs/common';
import { FacebookService } from './facebook.service.js';
import { FacebookController } from './facebook.controller.js';
import { FacebookSyncService } from './facebook-sync.service.js';

@Module({
  providers: [FacebookService, FacebookSyncService],
  controllers: [FacebookController],
  exports: [FacebookService]
})
export class FacebookModule {}
