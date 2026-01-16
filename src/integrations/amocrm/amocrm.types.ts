export type AmoMappingTrigger = 'PROGRAM_STARTED' | 'PROGRAM_COMPLETED' | 'RISK_HIGH' | 'CHECKIN_MISSED' | 'WEEK_1' | 'WEEK_2' | 'WEEK_3' | 'WEEK_4' | 'WEEK_5' | 'WEEK_6';

export interface AmoMappingRule {
    pipelineId: number;
    statusId: number;
}

export interface AmoCRMConfig {
    baseDomain: string; // e.g. 'subdomain.amocrm.ru'
    accessToken: string;
    pipelineId?: number;
    statusId?: number;
    mappings?: Record<AmoMappingTrigger, AmoMappingRule>;
}

export interface AmoLeadResponse {
    id: number;
    contact_id: number;
    company_id: number;
    request_id: string;
    merged: boolean;
}

export interface AmoComplexResponse {
    id: number;
    contact_id?: number;
    company_id?: number;
}

export interface AmoPipelineResponse {
    _embedded: {
        pipelines: Array<{
            id: number;
            name: string;
            is_main: boolean;
            is_unsorted_on: boolean;
            _embedded: {
                statuses: Array<{
                    id: number;
                    name: string;
                    color: string;
                }>
            }
        }>
    }
}

export interface AmoWebhookPayload {
    leads?: {
        status?: Array<{
            id: string;
            status_id: string;
            pipeline_id: string;
            old_status_id: string;
            old_pipeline_id: string;
        }>
    };
}
