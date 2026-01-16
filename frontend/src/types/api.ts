// API Response Types

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    meta?: {
        count?: number;
        limit?: number;
        offset?: number;
    };
}

// User Types
export interface User {
    id: string;
    email: string;
    fullName: string;
    role: 'ADMIN' | 'STAFF';
}

export interface LoginResponse {
    accessToken: string;
    user: User;
}

// Patient Types
export type ChatMode = 'AI' | 'HUMAN' | 'PAUSED';

export interface ProgramTemplate {
    id: string;
    name: string;
    durationDays: number;
}

export interface Patient {
    id: string;
    fullName: string;
    phone: string;
    chatMode: ChatMode;
    chatModeSetAt?: string;
    chatModeSetBy?: string;
    clinicId?: string;
    createdAt: string;
    updatedAt: string;
}

// Program Types
export type Slot = 'MORNING' | 'AFTERNOON' | 'EVENING';
export type CheckInStatus = 'PENDING' | 'RECEIVED' | 'MISSED' | 'ESCALATED';

export interface CheckIn {
    id: string;
    dayNumber: number;
    slot: Slot;
    status: CheckInStatus;
    type: 'WEIGHT' | 'MOOD' | 'DIET_ADHERENCE' | 'STEPS' | 'SLEEP' | 'FREE_TEXT' | 'ACTIVITY';
    valueNumber?: number;
    valueText?: string;
    valueBool?: boolean;
    media?: {
        type: 'photo' | 'audio';
        url: string;
    };
    source: 'PATIENT' | 'STAFF' | 'AI';
    title?: string;
    createdAt: string;
}

export interface ProgramInstance {
    id: string;
    patientId: string;
    templateId: string;
    startDate: string;
    endDate: string;
    currentDay: number;
    status: string;
    checkIns: CheckIn[];
    template?: {
        id: string;
        name: string;
        durationDays: number;
    };
}

export interface ProgramTemplate {
    id: string;
    name: string;
    durationDays: number;
    isActive: boolean;
}

// Message Types
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageSender = 'PATIENT' | 'AI' | 'STAFF' | 'SYSTEM';

export interface Message {
    id: string;
    patientId: string;
    direction: MessageDirection;
    sender: MessageSender;
    content: string | null;
    mediaUrl?: string | null;
    mediaType?: string | null;
    deliveryStatus?: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
    createdAt: string;
}

// Alert Types
export type AlertLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type AlertType = 'BAD_CONDITION' | 'REQUEST_MANAGER' | 'MISSED_CHECKIN' | 'OTHER';

export interface Alert {
    id: string;
    patientId: string;
    type: AlertType;
    level: AlertLevel;
    status: AlertStatus;
    title: string;
    description?: string | null;
    source: string;
    createdAt: string;
    patient?: {
        id: string;
        fullName: string;
        phone: string;
        chatMode: ChatMode;
    };
}

// Task Types
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type TaskType = 'CALL_PATIENT' | 'CHECK_MESSAGE' | 'REVIEW_ALERT' | 'CUSTOM';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface Task {
    id: string;
    patientId: string;
    alertId?: string | null;
    type: TaskType;
    status: TaskStatus;
    priority: TaskPriority;
    title: string;
    note?: string | null;
    assignedToId?: string | null;
    dueAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    createdAt: string;
    patient?: {
        id: string;
        fullName: string;
        phone: string;
    };
}

// Integration Types
export interface WhatsAppStatus {
    isEnabled: boolean;
    status: 'CONNECTED' | 'NOT_CONFIGURED' | 'WEBHOOK_MISSING' | 'AUTH_FAILED' | 'DISCONNECTED' | 'STARTING';
    qrCode?: string;
    details?: string;
}

export interface AIStatus {
    isEnabled: boolean;
    status: 'connected' | 'disconnected' | 'error';
    model?: string;
    error?: string;
}

export interface AmoCRMStatus {
    isConnected: boolean;
    baseDomain?: string;
    pipelineId?: number;
    statusId?: number;
    mappings?: Record<string, { pipelineId: number; statusId: number }>;
}

export interface AmoStatus {
    id: number;
    name: string;
    color: string;
}

export interface AmoPipeline {
    id: number;
    name: string;
    is_main: boolean;
    is_unsorted_on: boolean;
    _embedded: {
        statuses: AmoStatus[];
    };
}

// Patient Profile Types
export interface Medication {
    name: string;
    dose?: string;
    frequency?: string;
}

export interface NutritionPlan {
    kcalTarget?: number;
    proteinG?: number;
    fatG?: number;
    carbsG?: number;
    preferences?: string[];
    restrictions?: string[];
    notes?: string;
}

export interface PatientProfile {
    heightCm?: number;
    weightKg?: number;
    targetWeightKg?: number;
    activityLevel?: 'low' | 'medium' | 'high';
    goals?: string[];
    diagnoses?: string[];
    allergies?: string[];
    medications?: Medication[];
    program?: {
        templateId?: string;
        name?: string;
    };
    nutritionPlan?: NutritionPlan;
    notes?: string;
}
