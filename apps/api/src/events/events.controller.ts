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
  Res
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type Stripe from 'stripe';
import { EventsService } from './events.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import {
  CreateEventDto,
  UpdateEventDto,
  PurchaseTicketsDto,
  ValidateTicketDto,
  UpdateEventPostersDto,
  UpdateEventTicketDesignDto,
  GenerateTicketsDto
} from './dto/index.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permission, type TokenPayload } from '@kentslsc/shared';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly paymentsService: PaymentsService
  ) {}

  @Get()
  @Public()
  list(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search?: string,
    @Query('upcoming') upcoming?: string,
    @Query('category') category?: string
  ) {
    return this.eventsService.listPublished(Number(page) || 1, Number(limit) || 20, {
      search,
      upcoming: upcoming !== 'false',
      category
    });
  }

  @Get('admin')
  @RequirePermission(Permission.MANAGE_EVENTS)
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
  @RequirePermission(Permission.MANAGE_EVENTS)
  @ApiBearerAuth()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Put(':id')
  @RequirePermission(Permission.MANAGE_EVENTS)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Patch(':id')
  @RequirePermission(Permission.MANAGE_EVENTS)
  @ApiBearerAuth()
  patch(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(Permission.MANAGE_EVENTS)
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
    // Enforce route parameter matches body for consistency
    const body = { ...dto, eventId };
    return this.eventsService.createCheckoutSession(user.sub, body);
  }

  @Put(':id/posters')
  @RequirePermission(Permission.MANAGE_EVENTS)
  @ApiBearerAuth()
  updatePosters(@Param('id') id: string, @Body() dto: UpdateEventPostersDto) {
    return this.eventsService.updatePosterImages(id, dto);
  }

  @Put(':id/ticket-design')
  @RequirePermission(Permission.MANAGE_EVENTS)
  @ApiBearerAuth()
  updateTicketDesign(@Param('id') id: string, @Body() dto: UpdateEventTicketDesignDto) {
    return this.eventsService.updateTicketDesign(id, dto);
  }

  @Post(':id/tickets/generate')
  @RequirePermission(Permission.MANAGE_EVENTS)
  @ApiBearerAuth()
  generateTickets(
    @Param('id') eventId: string,
    @Body() dto: GenerateTicketsDto,
    @CurrentUser() user: TokenPayload
  ) {
    return this.eventsService.generateTickets(user.sub, eventId, dto);
  }

  @Get(':id/tickets')
  @RequirePermission(Permission.MANAGE_EVENTS)
  @ApiBearerAuth()
  listEventTickets(@Param('id') eventId: string) {
    return this.eventsService.listEventTickets(eventId);
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
  @ApiBearerAuth()
  list(@CurrentUser() user: TokenPayload) {
    return this.eventsService.getUserTickets(user.sub);
  }

  @Get(':id')
  @ApiBearerAuth()
  async findOne(@Param('id') id: string, @CurrentUser() user: TokenPayload) {
    const ticket = await this.eventsService.getTicketForUser(id, user.sub);
    const qrDataUrl = await this.eventsService.generateQrDataUrl(ticket.qrCodeValue);
    return { ...ticket, qrDataUrl };
  }

  @Get('validate/:qrCodeValue')
  @RequirePermission(Permission.MANAGE_TICKETS, Permission.MANAGE_EVENTS)
  @ApiBearerAuth()
  preview(@Param('qrCodeValue') qrCodeValue: string) {
    return this.eventsService.previewTicket(qrCodeValue);
  }

  @Post('validate')
  @RequirePermission(Permission.MANAGE_TICKETS, Permission.MANAGE_EVENTS)
  @ApiBearerAuth()
  validate(@Body() dto: ValidateTicketDto) {
    return this.eventsService.validateTicket(dto.qrCodeValue);
  }

  @Post(':id/resend')
  @ApiBearerAuth()
  resend(
    @Param('id') ticketId: string,
    @CurrentUser() user: TokenPayload
  ) {
    return this.eventsService.resendTicketEmail(ticketId, user.sub, user.email);
  }
}
