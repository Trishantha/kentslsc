import { IsInt, IsUUID, Min, Max } from 'class-validator';

export class PurchaseTicketsDto {
  @IsUUID()
  declare eventId: string;

  @IsInt()
  @Min(1)
  @Max(10)
  declare quantity: number;
}
