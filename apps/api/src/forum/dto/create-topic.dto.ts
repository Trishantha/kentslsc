import { IsString, MinLength, IsUUID } from 'class-validator';

export class CreateTopicDto {
  @IsUUID()
  declare categoryId: string;

  @IsString()
  @MinLength(1)
  declare title: string;

  @IsString()
  @MinLength(1)
  declare content: string;
}
