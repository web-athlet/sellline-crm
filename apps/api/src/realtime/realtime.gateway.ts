import { Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  transports: ['websocket'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('Realtime');

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`connect ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`disconnect ${client.id}`);
  }
}
