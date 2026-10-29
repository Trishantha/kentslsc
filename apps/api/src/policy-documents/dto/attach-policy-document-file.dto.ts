import { IsString, IsInt, IsOptional, MinLength, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttachPolicyDocumentFileDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  fileUrl!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  filePath!: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  fileSize?: number;
}
