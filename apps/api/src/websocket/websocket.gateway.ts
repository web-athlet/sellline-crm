import { Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { AuthService } from '../modules/auth/auth.service';

const parseAllowedOrigins = (): string[] =>
  (process.env.API_CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true);
      cb(null, parseAllowedOrigins().includes(origin));
    },
    credentials: true,
  },
  transports: ['websocket'],
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('Websocket');

  constructor(private readonly auth: AuthService) {}

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`reject ${client.id}: missing token`);
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.auth.verify(token);
      client.data.userId = payload.sub;
      client.data.tenantId = payload.tid;
      client.data.email = payload.email;
      this.logger.log(`connect ${client.id} tenant=${payload.tid}`);
    } catch {
      this.logger.warn(`reject ${client.id}: invalid token`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`disconnect ${client.id}`);
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === 'string') return auth.token;
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
