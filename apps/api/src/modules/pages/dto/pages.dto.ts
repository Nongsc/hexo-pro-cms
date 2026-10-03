import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SavePageDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  slug?: string;

  @IsOptional()
  @IsObject()
  frontMatter?: Record<string, any>;

  @IsOptional()
  @IsString()
  frontMatterYaml?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'discarded'])
  status?: string;
}
