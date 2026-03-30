import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      await client.join(userId);
      console.log(`User ${userId} connected`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected');
  }

  // রিয়েল-টাইম পাঠানোর মেথড
  send(userId: string, data: any) {
    this.server.to(userId).emit('notification', data);
  }
}
