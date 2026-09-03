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
  Req,
  Res
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { EventsService } from './events.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { CreateEventDto, UpdateEventDto, PurchaseTicketsDto, ValidateTicketDto, GenerateTicketsDto, ConfirmCheckoutDto, IssueTicketsDto, UpdateEventPostersDto, UpdateEventTicketDesignDto, RecordExternalTicketClickDto } from './dto/index.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permission, UserRole, type TokenPayload } from '@kentslsc/shared';

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
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  listAdmin(@Query('page') page: string, @Query('limit') limit: string) {
    return this.eventsService.listAll(Number(page) || 1, Number(limit) || 20);
  }

  @Get('admin/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  findOneAdmin(@Param('id') id: string) {
    return this.eventsService.findByIdWithTicketCountAdmin(id);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.eventsService.findByIdWithTicketCount(id, true);
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

  @Put(':id/posters')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  updatePosters(@Param('id') id: string, @Body() dto: UpdateEventPostersDto) {
    return this.eventsService.updatePosterImages(id, dto);
  }

  @Put(':id/ticket-design')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  updateTicketDesign(@Param('id') id: string, @Body() dto: UpdateEventTicketDesignDto) {
    return this.eventsService.updateTicketDesign(id, dto);
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
    // Enforce route parameter matches body for consistency
    const body = { ...dto, eventId };
    return this.eventsService.createCheckoutSession(user.sub, body);
  }

  @Get(':id/tickets')
  @RequirePermission(Permission.MANAGE_TICKETS)
  @ApiBearerAuth()
  listEventTickets(@Param('id') eventId: string) {
    return this.eventsService.listEventTickets(eventId);
  }

  @Get(':id/tickets/attachable-payments')
  @RequirePermission(Permission.MANAGE_TICKETS)
  @ApiBearerAuth()
  findAttachablePayments(
    @Param('id') eventId: string,
    @Query('userId') userId: string
  ) {
    return this.eventsService.findAttachablePayments(eventId, userId);
  }

  @Post(':id/tickets/generate')
  @RequirePermission(Permission.MANAGE_TICKETS)
  @ApiBearerAuth()
  generateTickets(
    @Param('id') eventId: string,
    @Body() dto: GenerateTicketsDto,
    @CurrentUser() user: TokenPayload
  ) {
    return this.eventsService.generateTickets(user.sub, eventId, dto);
  }

  @Post(':id/tickets/issue')
  @RequirePermission(Permission.MANAGE_TICKETS)
  @ApiBearerAuth()
  issueTickets(
    @Param('id') eventId: string,
    @Body() dto: IssueTicketsDto,
    @CurrentUser() user: TokenPayload
  ) {
    return this.eventsService.issueTicketsFromExistingSession(
      user.sub,
      eventId,
      dto.sessionId,
      dto.provider,
      dto.quantity ?? 1
    );
  }

  @Post(':id/external-ticket-click')
  @Public()
  async recordExternalTicketClick(
    @Param('id') eventId: string,
    @Body() _dto: RecordExternalTicketClickDto,
    @Req() req: Request,
    @CurrentUser() user?: TokenPayload
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      undefined;
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.eventsService.recordExternalTicketClick(
      eventId,
      user?.sub,
      ipAddress,
      userAgent
    );
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

  @Post(':id/resend')
  @ApiBearerAuth()
  resend(@Param('id') id: string, @CurrentUser() user: TokenPayload) {
    return this.eventsService.resendTicketEmail(id, user.sub, user.email);
  }

  @Get('validate/:qrCodeValue')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  validatePreview(@Param('qrCodeValue') qrCodeValue: string) {
    return this.eventsService.previewTicket(qrCodeValue);
  }

  @Post('validate')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  validate(@Body() dto: ValidateTicketDto) {
    return this.eventsService.validateTicket(dto.qrCodeValue);
  }

  @Post('confirm-payment')
  @ApiBearerAuth()
  confirmPayment(
    @Body() dto: ConfirmCheckoutDto,
    @CurrentUser() user: TokenPayload
  ) {
    return this.eventsService.confirmCheckoutSession(dto.sessionId, dto.provider, user.sub);
  }
}
