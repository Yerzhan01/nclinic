import type { Slot, CheckInStatus, CheckInType } from '@prisma/client';

// ============================================================================
// Program Types
// ============================================================================

export interface CreateProgramInstanceInput {
    patientId: string;
    templateId: string;
    startDate?: Date;
}

export interface CreateProgramInstanceResult {
    programInstanceId: string;
    startDate: Date;
    endDate: Date;
    checkInsCreated: number;
}

export interface ActiveProgramResponse {
    programInstance: {
        id: string;
        status: string;
        startDate: Date;
        endDate: Date;
        currentDay: number;
        template: {
            id: string;
            name: string;
            durationDays: number;
        };
    };
    currentDay: number;
    checkIns: CheckInDto[];
}

export interface CheckInDto {
    id: string;
    dayNumber: number;
    slot: Slot;
    expectedType: string;
    required: boolean;
    status: CheckInStatus;
    receivedMessageId: string | null;
    title?: string;
    createdAt: Date;
}

// ============================================================================
// Dynamic Rules Engine Types
// ============================================================================

export interface ProgramActivity {
    slot: Slot;        // MORNING | AFTERNOON | EVENING
    time: string;      // "10:00", "14:00" (Local time)
    type: CheckInType | 'VISIT'; // Prisma Enum or string literal
    question: string;  // "What is your weight today?" or "Reminder: Visit tomorrow"
    required: boolean;
}

export interface ProgramScheduleDay {
    day: number; // 1 to 42
    activities: ProgramActivity[];
}

export interface ProgramTemplateRules {
    schedule: ProgramScheduleDay[];
    // Future extensions: allowedMisses, riskTriggers, etc.
}
