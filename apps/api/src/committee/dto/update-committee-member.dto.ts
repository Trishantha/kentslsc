import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';

export class UpdateCommitteeMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare position?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare roleKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare photoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  declare displayOrder?: number;
}
