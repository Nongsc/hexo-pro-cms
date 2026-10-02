import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveDeployDto {
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
