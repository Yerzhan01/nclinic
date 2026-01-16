// WhatsApp Integration Types (Green API)

export interface WhatsAppConfig {
    idInstance: string;
    apiTokenInstance: string;
    apiUrl: string; // e.g. https://api.green-api.com
    mediaUrl: string; // e.g. https://media.green-api.com
    webhookUrl?: string;
}

export type WhatsAppDetailedStatus =
    | 'CONNECTED'
    | 'NOT_CONFIGURED'
    | 'WEBHOOK_MISSING'
    | 'AUTH_FAILED'
    | 'DISCONNECTED'
    | 'STARTING';

export interface WhatsAppConnectionStatus {
    status: WhatsAppDetailedStatus;
    qrCode?: string;
    details?: string;
}

export interface ParsedInboundMessage {
    phone: string;
    text?: string;
    mediaUrl?: string;
    mediaType?: string;
    whatsappMessageId: string;
    timestamp: number;
}

export interface SendMessageResult {
    whatsappMessageId: string;
    success: boolean;
}

// Green API webhook payload types
export interface GreenApiWebhookBody {
    typeWebhook: string;
    instanceData: {
        idInstance: number;
        wid: string;
        typeInstance: string;
    };
    timestamp: number;
    idMessage: string;
    senderData?: {
        chatId: string;
        sender: string;
        senderName: string;
    };
    messageData?: {
        typeMessage: string;
        textMessageData?: {
            textMessage: string;
        };
        extendedTextMessageData?: {
            text: string;
        };
        imageMessageData?: {
            downloadUrl: string;
            caption?: string;
        };
        fileMessageData?: {
            downloadUrl: string;
            fileName: string;
            caption?: string;
        };
    };
}

export interface ConnectWhatsAppInput {
    idInstance: string;
    apiTokenInstance: string;
    apiUrl: string;
    mediaUrl: string;
}
