import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AddTodoDto {
  @IsString()
  @MaxLength(300)
  content: string;

  @IsOptional()
  done?: boolean;
}
