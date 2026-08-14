import { IsString, IsOptional, IsUrl, IsObject } from 'class-validator';

export class UpdateEventTicketDesignDto {
  @IsOptional()
  @IsObject()
  declare ticketDesign?: Record<string, unknown>;
}
