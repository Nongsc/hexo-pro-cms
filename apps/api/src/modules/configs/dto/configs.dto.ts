import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveConfigDto {
  @IsString()
  @MaxLength(500)
  path: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class PathDto {
  @IsString()
  @MaxLength(500)
  path: string;
}

export class RollbackDto {
  @IsString()
  id: string;
}
