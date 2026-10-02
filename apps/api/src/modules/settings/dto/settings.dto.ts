import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateGithubConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  token?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  owner?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  repo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  branch?: string;
}

export class UpdateCosConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  secretId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  secretKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bucket?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  customDomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  basePath?: string;
}

export class UpdateDeployConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  workflowId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ref?: string;

  @IsOptional()
  @IsBoolean()
  autoTrigger?: boolean;
}

export class UpdateSystemConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  siteName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  siteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;
}
