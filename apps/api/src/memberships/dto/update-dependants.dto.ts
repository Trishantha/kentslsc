import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DependantDto } from './dependant.dto.js';

export class UpdateDependantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DependantDto)
  declare dependants: DependantDto[];
}
