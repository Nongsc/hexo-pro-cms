import { IsOptional, IsString, MaxLength } from 'class-validator';

export class InstallThemeDto {
  @IsString()
  @MaxLength(300)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  branch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class SwitchThemeDto {
  @IsString()
  @MaxLength(100)
  name: string;
}

export class SaveThemeConfigDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
