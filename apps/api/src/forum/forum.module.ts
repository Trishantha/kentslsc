import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ForumService } from './forum.service.js';
import { ForumController } from './forum.controller.js';
import { ForumGateway } from './forum.gateway.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [
    AiModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_ACCESS_EXPIRY') ?? '15m' }
      }),
      inject: [ConfigService]
    })
  ],
  providers: [ForumService, ForumGateway],
  controllers: [ForumController],
  exports: [ForumService]
})
export class ForumModule {}
