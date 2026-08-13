import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ForumService } from './forum.service.js';
import { ForumController } from './forum.controller.js';
import { ForumGateway } from './forum.gateway.js';
import { AiModule } from '../ai/ai.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { TokenModule } from '../auth/token.module.js';

@Module({
  imports: [
    AiModule,
    ConfigModule,
    AuthorizationModule,
    TokenModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRY') ?? '15m') as never
        }
      }),
      inject: [ConfigService]
    })
  ],
  providers: [ForumService, ForumGateway],
  controllers: [ForumController],
  exports: [ForumService]
})
export class ForumModule {}
