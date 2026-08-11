import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, Logger } from '@nestjs/common';
import { ForumService } from './forum.service.js';
import type { TokenPayload } from '@kentslsc/shared';
import { TokenValidationService } from '../auth/token-validation.service.js';

const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

@WebSocketGateway({ namespace: 'forum', cors: { origin: frontendUrl, credentials: true } })
export class ForumGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ForumGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly forumService: ForumService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenValidation: TokenValidationService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        throw new UnauthorizedException('Missing auth token');
      }
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET')
      });
      // Route through the shared validator rather than trusting the payload:
      // verifying the signature alone skips the deleted-user check and the
      // revocation denylist, so a logged-out user could still open a socket.
      // Requiring typ 'ws' also stops an access token being used here.
      const user = await this.tokenValidation.validate(payload, 'ws');
      client.data.user = user;
      this.logger.debug(`Client connected: ${client.id} (${user.sub})`);
    } catch (err) {
      this.logger.warn(`Socket auth failed: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-topic')
  handleJoin(@MessageBody() topicId: string, @ConnectedSocket() client: Socket) {
    client.join(topicId);
  }

  @SubscribeMessage('leave-topic')
  handleLeave(@MessageBody() topicId: string, @ConnectedSocket() client: Socket) {
    client.leave(topicId);
  }

  @SubscribeMessage('new-post')
  async handleNewPost(
    @MessageBody() payload: { topicId: string; content: string },
    @ConnectedSocket() client: Socket
  ) {
    const user = client.data.user as TokenPayload | undefined;
    if (!user) {
      client.emit('post-error', { message: 'Not authenticated' });
      return;
    }

    try {
      const result = await this.forumService.createPost(user, payload);
      this.server.to(payload.topicId).emit('post', result.post);
    } catch (err) {
      this.logger.error(`Failed to create post: ${(err as Error).message}`);
      client.emit('post-error', { message: (err as Error).message });
    }
  }
}
