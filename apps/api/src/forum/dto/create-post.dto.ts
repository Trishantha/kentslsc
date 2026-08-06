import { IsString, MinLength, IsUUID } from 'class-validator';

export class CreatePostDto {
  @IsUUID()
  declare topicId: string;

  @IsString()
  @MinLength(1)
  declare content: string;
}
