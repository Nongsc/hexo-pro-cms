import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadImageDto {
  @IsOptional()
  @IsString()
  data?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  filename?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  folder?: string;
}

export class RenameImageDto {
  @IsString()
  @MaxLength(200)
  filename: string;
}

export class MoveImageDto {
  @IsArray()
  ids: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  folder?: string;
}

export class DeleteBatchDto {
  @IsArray()
  ids: string[];
}

export class SaveStorageConfigDto {
  @IsOptional()
  @IsString()
  secretId?: string;

  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsString()
  bucket?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  customDomain?: string;

  @IsOptional()
  @IsString()
  basePath?: string;
}

export class PresignDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  filename?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  folder?: string;
}

export class ConfirmDto {
  @IsString()
  @MaxLength(500)
  key: string;

  @IsString()
  @MaxLength(200)
  filename: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentType?: string;

  @IsOptional()
  size?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  folder?: string;
}
