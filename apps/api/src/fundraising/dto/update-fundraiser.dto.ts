import { PartialType } from '@nestjs/swagger';
import { CreateFundraiserDto } from './create-fundraiser.dto.js';

export class UpdateFundraiserDto extends PartialType(CreateFundraiserDto) {}
