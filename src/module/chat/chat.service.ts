import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ChatAttachment {
  url?: string;
  fileUrl?: string;
  type?: string;
  fileType?: string;
}

export interface ChatListItem {
  conversationId: string;
  contactInfo: {
    id: string;
    athleteFullName: string | null;
    imgUrl: string | null;
  };
  lastMessage: {
    id: string;
    content: string | null;
    createdAt: Date;
  } | null;
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // Start Chat
  async startChat(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new BadRequestException(
        'You cannot start a conversation with yourself',
      );
    }

    try {
      return await this.prisma.client.$transaction(
        async (tx) => {
          let conversation = await tx.conversation.findFirst({
            where: {
              AND: [
                { participants: { some: { id: senderId } } },
                { participants: { some: { id: receiverId } } },
              ],
            },
            include: {
              participants: {
                select: { id: true, athleteFullName: true, imgUrl: true },
              },
            },
          });

          if (!conversation) {
            conversation = await tx.conversation.create({
              data: {
                participants: {
                  connect: [{ id: senderId }, { id: receiverId }],
                },
              },
              include: {
                participants: {
                  select: { id: true, athleteFullName: true, imgUrl: true },
                },
              },
            });
          }

          return conversation;
        },
        {
          isolationLevel: 'Serializable',
        },
      );
    } catch (error) {
      console.error('Error in startChat:', error);
      throw new InternalServerErrorException('Could not initiate conversation');
    }
  }

  // saveMessage
  async saveMessage(data: {
    senderId: string;
    receiverId: string;
    conversationId: string;
    content?: string;
    files?: ChatAttachment[];
  }) {
    const { senderId, receiverId, conversationId, content, files } = data;
    const filesArray = Array.isArray(files) ? files : [];

    try {
      const message = await this.prisma.client.message.create({
        data: {
          content: content ?? null,
          sender: { connect: { id: senderId } },
          receiver: { connect: { id: receiverId } },
          conversation: { connect: { id: conversationId } },
          attachments: {
            create: filesArray.map((file) => ({
              fileUrl: file.url ?? file.fileUrl ?? '',
              fileType: file.type ?? file.fileType ?? 'FILE',
            })),
          },
        },
        include: {
          attachments: true,
          sender: {
            select: { id: true, athleteFullName: true, imgUrl: true },
          },
        },
      });

      this.prisma.client.conversation
        .update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        })
        .catch((err) => console.error('Update Conversation Time Error:', err));

      return message;
    } catch (error) {
      console.error('SaveMessage Error:', error);
      if (error.code === 'P2025') {
        throw new NotFoundException(
          'Conversation, Sender or Receiver not found',
        );
      }
      throw new InternalServerErrorException('Failed to process message');
    }
  }

  // Chat History
  async getChatHistory(userId: string, contactId: string) {
    try {
      return await this.prisma.client.message.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: contactId },
            { senderId: contactId, receiverId: userId },
          ],
        },
        include: {
          attachments: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Could not fetch chat history');
    }
  }

  // My Chat List
  async getMyChatList(
    userId: string,
    limit: number = 50,
    skip: number = 0,
  ): Promise<ChatListItem[]> {
    try {
      const conversations = await this.prisma.client.conversation.findMany({
        where: {
          participants: { some: { id: userId } },
        },
        include: {
          participants: {
            where: { id: { not: userId } },
            select: { id: true, athleteFullName: true, imgUrl: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: skip,
      });

      return conversations.map((conv) => {
        const contact = conv.participants[0];
        const lastMsg = conv.messages[0];

        return {
          conversationId: conv.id,
          contactInfo: {
            id: contact?.id ?? '',
            athleteFullName: contact?.athleteFullName ?? null,
            imgUrl: contact?.imgUrl ?? null,
          },
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                content: lastMsg.content,
                createdAt: lastMsg.createdAt,
              }
            : null,
        };
      });
    } catch (error) {
      console.error('Error in getMyChatList:', error);
      throw new InternalServerErrorException('Could not fetch chat list');
    }
  }
}
