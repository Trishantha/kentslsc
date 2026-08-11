import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TokenValidationService } from './token-validation.service.js';

/**
 * TokenValidationService lives in its own module so both AuthModule and
 * ForumModule can depend on it without ForumModule having to import the whole
 * AuthModule (which pulls in MembershipsModule and would risk a cycle).
 *
 * Its only other dependencies — PrismaService and RedisService — are global.
 */
@Module({
  imports: [ConfigModule],
  providers: [TokenValidationService],
  exports: [TokenValidationService]
})
export class TokenModule {}
