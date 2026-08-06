import { IsEnum, IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';

export class AiRecommendDto {
  @IsEnum(['events', 'fundraisers', 'topics', 'businesses'])
  declare type: 'events' | 'fundraisers' | 'topics' | 'businesses';

  @IsOptional()
  @IsUUID()
  declare userId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  declare limit?: number;
}
