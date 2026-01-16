import type { MessageDirection, MessageSender, Slot } from '@prisma/client';

export interface MessageDto {
    id: string;
    patientId: string;
    direction: MessageDirection;
    sender: MessageSender;
    content: string | null;
    mediaUrl: string | null;
    linkedCheckInId: string | null;
    createdAt: Date;
}

export interface SaveInboundMessageInput {
    phone: string;
    text?: string;
    mediaUrl?: string;
    mediaType?: string;
    whatsappMessageId: string;
    timestamp: number;
}

export interface SendStaffMessageInput {
    patientId: string;
    text: string;
}

export interface SlotTimeRange {
    slot: Slot;
    startHour: number;
    endHour: number;
}
