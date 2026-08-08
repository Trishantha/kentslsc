import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseStorageService } from './supabase.service.js';
import { SUPABASE_CLIENT } from './supabase.constants.js';

const supabaseFactory = {
  provide: SUPABASE_CLIENT,
  useFactory: (configService: ConfigService): SupabaseClient | null => {
    const url = configService.get<string>('SUPABASE_URL');
    const key = configService.get<string>('SUPABASE_SERVICE_KEY');
    if (!url || !key) {
      return null;
    }
    return createClient(url, key);
  },
  inject: [ConfigService]
};

@Global()
@Module({
  providers: [supabaseFactory, SupabaseStorageService],
  exports: [supabaseFactory, SupabaseStorageService]
})
export class SupabaseModule {}
