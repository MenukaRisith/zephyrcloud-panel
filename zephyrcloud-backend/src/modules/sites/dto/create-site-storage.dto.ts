import { Transform } from 'class-transformer';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateSiteStorageDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(2)
  public mount_path!: string;

  @Transform(({ value }) => {
    const parsed =
      typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : value;
  })
  @IsInt()
  @Min(1)
  public size_gb!: number;
}
