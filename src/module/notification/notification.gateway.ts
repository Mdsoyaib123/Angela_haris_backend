import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (userId) {
      await client.join(userId);
      console.log(`User connected and joined room: ${userId}`);
    } else {
      console.log(`Client connected without userId: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  sendNotification(userId: string, payload: any) {
    this.server.to(userId).emit('notification', payload);
  }

  sendToUser(userId: string, data: any) {
    // console.log(`Sending notification to user: ${userId}`, data);
    this.server.to(userId).emit('notification', data);
  }

  @SubscribeMessage('ping')
  handleMessage(client: Socket, payload: any) {
    return { event: 'pong', data: payload };
  }
}
