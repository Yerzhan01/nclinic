import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';
import type { Patient } from '@prisma/client';
import type { AmoCRMConfig, AmoComplexResponse, AmoMappingTrigger } from './amocrm.types.js';

export class AmoCRMService {
    private configCache: AmoCRMConfig | null = null;

    /**
     * Sync Patient State based on Trigger
     * Moves the lead to a specific status if mapping exists
     */
    async syncPatientState(patientId: string, trigger: AmoMappingTrigger): Promise<void> {
        const config = await this.getConfig();
        if (!config || !config.mappings || !config.mappings[trigger]) return;

        try {
            const patient = await prisma.patient.findUnique({
                where: { id: patientId }
            });

            if (!patient || !patient.amoLeadId) {
                logger.warn({ patientId, trigger }, 'amoCRM sync skipped: Patient not found or no lead ID');
                return;
            }

            const rule = config.mappings[trigger];
            await this.updateLeadStatus(patient.amoLeadId, rule.pipelineId, rule.statusId);
            logger.info({ patientId, trigger, rule }, 'amoCRM sync: Lead status updated');
        } catch (error) {
            logger.error({ error, patientId, trigger }, 'amoCRM syncPatientState error');
        }
    }

    /**
     * Update Lead Status directly
     */
    async updateLeadStatus(leadId: string, pipelineId: number, statusId: number): Promise<boolean> {
        const config = await this.getConfig();
        if (!config) return false;

        try {
            const url = `https://${config.baseDomain}/api/v4/leads/${leadId}`;
            const payload = {
                pipeline_id: pipelineId,
                status_id: statusId
            };

            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.accessToken}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.text();
                logger.error({ status: response.status, error, leadId }, 'amoCRM updateLeadStatus failed');
                return false;
            }

            return true;
        } catch (error) {
            logger.error({ error, leadId }, 'amoCRM updateLeadStatus error');
            return false;
        }
    }

    /**
     * Get amoCRM config
     */
    async getConfig(): Promise<AmoCRMConfig | null> {
        if (this.configCache) return this.configCache;

        const settings = await prisma.integrationSettings.findUnique({
            where: { type: 'amocrm' },
        });

        if (!settings || !settings.isEnabled) {
            return null;
        }

        const config = settings.config as unknown as AmoCRMConfig;
        this.configCache = config;
        return config;
    }

    /**
     * Save amoCRM config
     */
    async saveConfig(config: AmoCRMConfig): Promise<void> {
        await prisma.integrationSettings.upsert({
            where: { type: 'amocrm' },
            update: {
                config: config as object,
                isEnabled: true,
            },
            create: {
                type: 'amocrm',
                config: config as object,
                isEnabled: true,
            },
        });
        this.configCache = config;
        logger.info('amoCRM configuration saved');
    }

    /**
     * Create Lead + Contact in amoCRM (Complex method)
     */
    async createLead(patient: Patient, programName?: string): Promise<string | null> {
        const config = await this.getConfig();
        if (!config) return null;

        try {
            // 1. Try to find existing contact
            const existingContactId = await this.findContactByPhone(patient.phone);

            if (existingContactId) {
                logger.info({ patientId: patient.id, contactId: existingContactId }, 'amoCRM Existing contact found, creating linked lead');
                return await this.createLeadLinkedToContact(existingContactId, programName, patient);
            }

            // 2. If not found, create complex (Lead + Contact)
            const url = `https://${config.baseDomain}/api/v4/leads/complex`;
            const payload = [
                {
                    name: patient.fullName,
                    _embedded: {
                        tags: [{ name: 'patient' }],
                        contacts: [
                            {
                                first_name: patient.fullName.split(' ')[0],
                                last_name: patient.fullName.split(' ').slice(1).join(' '),
                                custom_fields_values: [
                                    {
                                        field_code: 'PHONE',
                                        values: [{ value: patient.phone }]
                                    }
                                ]
                            }
                        ]
                    },
                    pipeline_id: config.pipelineId,
                    status_id: config.statusId,
                    // Add initial note about program
                    ...(programName ? [{
                        _embedded: {
                            notes: [
                                {
                                    note_type: 'common',
                                    params: {
                                        text: `Program: ${programName}\nChat Mode: ${patient.chatMode}\nStarted: ${new Date().toLocaleDateString()}`
                                    }
                                }
                            ]
                        }
                    }] : [])
                }
            ];

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.accessToken}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.text();
                logger.error({ status: response.status, error }, 'amoCRM createLead failed');
                return null;
            }

            const data = await response.json() as Array<AmoComplexResponse>;
            if (data && data.length > 0) {
                const leadId = data[0].id.toString();
                logger.info({ leadId, patientId: patient.id }, 'amoCRM Lead created (new contact)');
                return leadId;
            }

            return null;
        } catch (error) {
            logger.error({ error }, 'amoCRM createLead error');
            return null;
        }
    }

    /**
     * Add note to existing lead (e.g. for Alerts)
     */
    async addNote(leadId: string, text: string): Promise<void> {
        const config = await this.getConfig();
        if (!config) return;

        try {
            const url = `https://${config.baseDomain}/api/v4/leads/${leadId}/notes`;

            const payload = [
                {
                    note_type: 'common',
                    params: { text }
                }
            ];

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.accessToken}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.text();
                logger.error({ status: response.status, error, leadId }, 'amoCRM addNote failed');
            } else {
                logger.info({ leadId }, 'amoCRM note added');
            }
        } catch (error) {
            logger.error({ error, leadId }, 'amoCRM addNote error');
        }
    }
    /**
     * Find contact by phone number
     */
    async findContactByPhone(phone: string): Promise<number | null> {
        const config = await this.getConfig();
        if (!config) return null;

        try {
            // Normalize phone: remove non-digits
            const normalizedPhone = phone.replace(/\D/g, '');
            if (!normalizedPhone || normalizedPhone.length < 6) return null;

            const url = `https://${config.baseDomain}/api/v4/contacts?query=${normalizedPhone}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${config.accessToken}` }
            });

            if (!response.ok) return null;

            const data = await response.json() as any;
            // Check embedded contacts
            if (data._embedded && data._embedded.contacts && data._embedded.contacts.length > 0) {
                // Return the first found contact ID
                return data._embedded.contacts[0].id;
            }
            return null;
        } catch (error) {
            logger.error({ error, phone }, 'amoCRM findContactByPhone error');
            return null;
        }
    }

    /**
     * Create Lead linked to existing Contact
     */
    async createLeadLinkedToContact(contactId: number, programName?: string, patient?: Patient): Promise<string | null> {
        const config = await this.getConfig();
        if (!config) return null;

        try {
            const url = `https://${config.baseDomain}/api/v4/leads`;
            const payload = [
                {
                    name: patient ? patient.fullName : 'New Lead',
                    _embedded: {
                        contacts: [{ id: contactId }]
                    },
                    pipeline_id: config.pipelineId,
                    status_id: config.statusId,
                    // Add initial note about program via custom fields or just creates lead first
                }
            ];

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.accessToken}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.text();
                logger.error({ status: response.status, error }, 'amoCRM createLeadLinkedToContact failed');
                return null;
            }

            const data = await response.json() as Array<AmoComplexResponse>;
            if (data && data.length > 0) {
                const leadId = data[0].id.toString();
                // Add note separately if needed
                if (programName && patient) {
                    await this.addNote(leadId, `Program: ${programName}\nChat Mode: ${patient.chatMode}\nStarted: ${new Date().toLocaleDateString()}`);
                }
                return leadId;
            }
            return null;

        } catch (error) {
            logger.error({ error }, 'amoCRM createLeadLinkedToContact error');
            return null;
        }
    }

    async testConnection(): Promise<boolean> {
        const config = await this.getConfig();
        if (!config) return false;

        try {
            const url = `https://${config.baseDomain}/api/v4/leads`; // Lightweight check
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.ok;
        } catch (error) {
            logger.error({ error }, 'amoCRM test connection failed');
            return false;
        }
    }

    /**
     * Disconnect amoCRM (disable)
     */
    async disconnect(): Promise<void> {
        await prisma.integrationSettings.update({
            where: { type: 'amocrm' },
            data: { isEnabled: false }
        });
        this.configCache = null;
        logger.info('amoCRM disconnected');
    }

    /**
     * Get pipelines from amoCRM
     */
    async getPipelines(): Promise<any[]> {
        const config = await this.getConfig();
        if (!config) return [];

        try {
            const url = `https://${config.baseDomain}/api/v4/leads/pipelines`;
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${config.accessToken}` }
            });

            if (!response.ok) return [];

            const data = await response.json() as any;
            if (data._embedded && data._embedded.pipelines) {
                return data._embedded.pipelines;
            }
            return [];
        } catch (error) {
            logger.error({ error }, 'amoCRM getPipelines error');
            return [];
        }
    }

    /**
     * Handle incoming webhook from amoCRM
     */
    async handleWebhook(payload: any): Promise<void> {
        logger.info({ payload }, 'Received amoCRM webhook');
    }
}

export const amoCRMService = new AmoCRMService();
