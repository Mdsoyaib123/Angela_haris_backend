import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/sendMessage.dto';
import { UsePipes, ValidationPipe, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@WebSocketGateway({
  cors: { origin: process.env.BASE_URL || '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private chatService: ChatService) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      await client.join(userId);
      this.logger.log(`User connected and joined room: ${userId}`);
    } else {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
    this.logger.log(`User disconnected: ${userId}`);
  }

  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('sendMessage')
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageDto,
  ) {
    const senderId = client.handshake.query.userId as string;
    const { receiverId, conversationId } = payload;

    if (!conversationId || !senderId || !receiverId) {
      client.emit('error', { message: 'Missing IDs' });
      return;
    }

    const serverGeneratedTempId = `temp_${uuidv4()}`;

    const optimisticMessage = {
      ...payload,
      tempId: serverGeneratedTempId,
      senderId,
      createdAt: new Date().toISOString(),
      status: 'sent',
    };

    this.server.to(receiverId).emit('newMessage', optimisticMessage);
    client.emit('messageAcknowledged', { tempId: serverGeneratedTempId });

    try {
      this.chatService
        .saveMessage({
          senderId,
          ...payload,
        })
        .then((savedMessage) => {
          this.server.to(senderId).emit('messageSent', {
            tempId: serverGeneratedTempId,
            savedMessage,
          });
        })
        .catch((dbError) => {
          this.logger.error(`Database Error: ${dbError.message}`);
          client.emit('messageError', {
            tempId: serverGeneratedTempId,
            message: 'Message could not be saved to database',
          });
        });
    } catch (error: any) {
      this.logger.error(`System Error: ${error.message}`);
      client.emit('error', { message: 'Failed to process message' });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { receiverId: string; isTyping: boolean },
  ) {
    const senderId = client.handshake.query.userId as string;
    this.server.to(payload.receiverId).emit('displayTyping', {
      senderId,
      isTyping: payload.isTyping,
    });
  }
}
