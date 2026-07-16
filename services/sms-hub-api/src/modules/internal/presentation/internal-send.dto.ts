import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InternalSendDto {
  @ApiProperty({ example: '5511999999999' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: 'RELAY,0#' })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiProperty({ required: false, example: 'desbloquear' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  vehicle_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  source?: string;
}
