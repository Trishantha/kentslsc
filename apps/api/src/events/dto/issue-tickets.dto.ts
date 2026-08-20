import { IsString, IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class IssueTicketsDto {
  @IsString()
  sessionId!: string;

  @IsString()
  @IsIn(['stripe', 'paypal'])
  provider!: 'stripe' | 'paypal';

  @IsNumber()
  @IsOptional()
  @Min(1)
  quantity?: number;
}
