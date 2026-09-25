import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMenuItemDto {
  @IsOptional()
  @IsUUID()
  declare parentId?: string | null;

  @IsString()
  @MinLength(1)
  declare labelEn: string;

  @IsOptional()
  @IsString()
  declare labelSi?: string;

  @IsOptional()
  @IsString()
  declare labelTa?: string;

  @IsOptional()
  @IsIn(['path', 'page'])
  declare linkType?: 'path' | 'page';

  @IsOptional()
  @IsString()
  declare path?: string;

  @IsOptional()
  @IsUUID()
  declare pageId?: string;

  @IsOptional()
  @IsInt()
  declare sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  declare isVisible?: boolean;
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsUUID()
  declare parentId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  declare labelEn?: string;

  @IsOptional()
  @IsString()
  declare labelSi?: string;

  @IsOptional()
  @IsString()
  declare labelTa?: string;

  @IsOptional()
  @IsIn(['path', 'page'])
  declare linkType?: 'path' | 'page';

  @IsOptional()
  @IsString()
  declare path?: string;

  @IsOptional()
  @IsUUID()
  declare pageId?: string;

  @IsOptional()
  @IsInt()
  declare sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  declare isVisible?: boolean;
}

export class MenuItemOrderEntryDto {
  @IsUUID()
  declare id: string;

  @IsOptional()
  @IsUUID()
  declare parentId?: string | null;

  @IsInt()
  declare sortOrder: number;
}

export class ReorderMenuItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemOrderEntryDto)
  declare entries: MenuItemOrderEntryDto[];
}
