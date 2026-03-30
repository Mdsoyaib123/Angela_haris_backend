// import { Injectable } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';

// interface ChatAttachment {
//   url?: string;
//   fileUrl?: string;
//   type?: string;
//   fileType?: string;
// }

// export interface ChatListItem {
//   contactInfo: {
//     id: string;
//     athleteFullName: string | null;
//     imgUrl: string | null;
//   };
//   lastMessage: {
//     content: string | null;
//     createdAt: Date;
//     id: string;
//   };
// }

// @Injectable()
// export class ChatService {
//   constructor(private prisma: PrismaService) {}

//   async saveMessage(data: {
//     senderId: string;
//     receiverId: string;
//     content?: string;
//     files?: ChatAttachment[];
//   }) {
//     const filesArray: ChatAttachment[] = Array.isArray(data.files)
//       ? data.files
//       : [];

//     return await this.prisma.client.message.create({
//       data: {
//         senderId: data.senderId,
//         receiverId: data.receiverId,
//         content: data.content,
//         attachments: {
//           create: filesArray.map((file: ChatAttachment) => ({
//             fileUrl: file.url ?? file.fileUrl ?? '',
//             fileType: file.type ?? file.fileType ?? 'FILE',
//           })),
//         },
//       },
//       include: {
//         attachments: true,
//         sender: {
//           select: { id: true, athleteFullName: true, imgUrl: true },
//         },
//       },
//     });
//   }

//   async saveMessage1(data: {
//     senderId: string;
//     receiverId: string;
//     content?: string;
//     files?: { url: string; type: string }[];
//   }) {
//     return await this.prisma.client.message.create({
//       data: {
//         senderId: data.senderId,
//         receiverId: data.receiverId,
//         content: data.content,
//         attachments: {
//           create: data.files?.map((file) => ({
//             fileUrl: file.url,
//             fileType: file.type,
//           })),
//         },
//       },
//       include: {
//         attachments: true,
//         sender: {
//           select: { id: true, athleteFullName: true, imgUrl: true },
//         },
//       },
//     });
//   }

//   async getChatHistory(userId: string, contactId: string) {
//     return await this.prisma.client.message.findMany({
//       where: {
//         OR: [
//           { senderId: userId, receiverId: contactId },
//           { senderId: contactId, receiverId: userId },
//         ],
//       },
//       include: {
//         attachments: true,
//       },
//       orderBy: { createdAt: 'asc' },
//     });
//   }

//   async getMyChatList(userId: string): Promise<ChatListItem[]> {
//     const messages = await this.prisma.client.message.findMany({
//       where: {
//         OR: [{ senderId: userId }, { receiverId: userId }],
//       },
//       orderBy: { createdAt: 'desc' },
//       include: {
//         sender: { select: { id: true, athleteFullName: true, imgUrl: true } },
//         receiver: { select: { id: true, athleteFullName: true, imgUrl: true } },
//       },
//     });

//     const chatMap = new Map<string, ChatListItem>();

//     messages.forEach((msg) => {
//       const contact = msg.senderId === userId ? msg.receiver : msg.sender;
//       const contactId = contact.id;

//       if (!chatMap.has(contactId)) {
//         chatMap.set(contactId, {
//           contactInfo: contact,
//           lastMessage: {
//             content: msg.content,
//             createdAt: msg.createdAt,
//             id: msg.id,
//           },
//         });
//       }
//     });

//     return Array.from(chatMap.values());
//   }
// }
