import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  RawBody,
  Res,
  ForbiddenException
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type Stripe from 'stripe';
import { EventsService } from './events.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { CreateEventDto, UpdateEventDto, PurchaseTicketsDto, ValidateTicketDto } from './dto/index.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole, MembershipFeature, type TokenPayload } from '@kentslsc/shared';
import { MembershipFeaturesService } from '../memberships/membership-features.service.js';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly paymentsService: PaymentsService,
    private readonly featuresService: MembershipFeaturesService
  ) {}

  @Get()
  @Public()
  list(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search?: string,
    @Query('upcoming') upcoming?: string
  ) {
    return this.eventsService.listPublished(Number(page) || 1, Number(limit) || 20, {
      search,
      upcoming: upcoming !== 'false'
    });
  }

  @Get('admin')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  listAdmin(@Query('page') page: string, @Query('limit') limit: string) {
    return this.eventsService.listAll(Number(page) || 1, Number(limit) || 20);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.eventsService.findByIdWithTicketCount(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  patch(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }

  @Post(':id/tickets/purchase')
  @ApiBearerAuth()
  async purchase(
    @Param('id') eventId: string,
    @Body() dto: PurchaseTicketsDto,
    @CurrentUser() user: TokenPayload
  ) {
    const event = await this.eventsService.findById(eventId);
    const isFree = event.isFree || Number(event.ticketPrice) === 0;
    if (!isFree && user.role !== UserRole.ADMIN) {
      const hasFeature = await this.featuresService.userHasFeature(user.sub, MembershipFeature.TICKETS_PURCHASE);
      if (!hasFeature) {
        throw new ForbiddenException('Your membership does not include ticket purchases');
      }
    }
    // Enforce route parameter matches body for consistency
    const body = { ...dto, eventId };
    return this.eventsService.createCheckoutSession(user.sub, body);
  }

  @Post('webhook')
  @Public()
  async webhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() rawBody: Buffer,
    @Res() res: Response
  ) {
    try {
      const event = await this.paymentsService.constructEvent(rawBody, signature);
      if (event.type === 'checkout.session.completed') {
        await this.eventsService.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      }
      return res.json({ received: true });
    } catch (err) {
      return res.status(400).send(`Webhook error: ${(err as Error).message}`);
    }
  }
}

@ApiTags('Tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @RequiresFeature(MembershipFeature.MEMBER_CARD)
  @ApiBearerAuth()
  list(@CurrentUser() user: TokenPayload) {
    return this.eventsService.getUserTickets(user.sub);
  }

  @Get(':id')
  @RequiresFeature(MembershipFeature.MEMBER_CARD)
  @ApiBearerAuth()
  async findOne(@Param('id') id: string, @CurrentUser() user: TokenPayload) {
    const ticket = await this.eventsService.getTicketForUser(id, user.sub);
    const qrDataUrl = await this.eventsService.generateQrDataUrl(ticket.qrCodeValue);
    return { ...ticket, qrDataUrl };
  }

  @Post('validate')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  validate(@Body() dto: ValidateTicketDto) {
    return this.eventsService.validateTicket(dto.qrCodeValue);
  }
}
