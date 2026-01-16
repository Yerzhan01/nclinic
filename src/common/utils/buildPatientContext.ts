import type { PatientProfile } from '@/modules/patients/patient-profile.schema.js';

/**
 * Builds a human-readable context string from a patient profile for AI prompts.
 * Truncates arrays to 10 items, notes to 500 chars.
 */
export function buildPatientContext(profile: PatientProfile | null | undefined): string {
    if (!profile || Object.keys(profile).length === 0) {
        return 'Профиль пациента не заполнен. Уточните данные у пациента.';
    }

    const lines: string[] = ['=== КОНТЕКСТ ПАЦИЕНТА ==='];

    // Anthropometry
    if (profile.heightCm || profile.weightKg || profile.targetWeightKg) {
        const parts: string[] = [];
        if (profile.heightCm) parts.push(`Рост: ${profile.heightCm} см`);
        if (profile.weightKg) parts.push(`Вес: ${profile.weightKg} кг`);
        if (profile.targetWeightKg) parts.push(`Цель: ${profile.targetWeightKg} кг`);
        if (profile.activityLevel) {
            const levels = { low: 'низкая', medium: 'средняя', high: 'высокая' };
            parts.push(`Активность: ${levels[profile.activityLevel]}`);
        }
        lines.push(`Антропометрия: ${parts.join(', ')}`);
    }

    // Goals
    if (profile.goals?.length) {
        lines.push(`Цели: ${profile.goals.slice(0, 10).join(', ')}`);
    }

    // Program
    if (profile.program?.name) {
        lines.push(`Программа: ${profile.program.name}`);
    }

    // Nutrition plan
    if (profile.nutritionPlan) {
        const np = profile.nutritionPlan;
        const parts: string[] = [];
        if (np.kcalTarget) parts.push(`${np.kcalTarget} ккал`);
        if (np.proteinG) parts.push(`Б: ${np.proteinG}г`);
        if (np.fatG) parts.push(`Ж: ${np.fatG}г`);
        if (np.carbsG) parts.push(`У: ${np.carbsG}г`);
        if (parts.length) lines.push(`План питания: ${parts.join(', ')}`);
        if (np.preferences?.length) {
            lines.push(`Предпочтения: ${np.preferences.slice(0, 10).join(', ')}`);
        }
        if (np.restrictions?.length) {
            lines.push(`Ограничения: ${np.restrictions.slice(0, 10).join(', ')}`);
        }
    }

    // Medical
    if (profile.diagnoses?.length) {
        lines.push(`Диагнозы: ${profile.diagnoses.slice(0, 10).join(', ')}`);
    }
    if (profile.allergies?.length) {
        lines.push(`Аллергии: ${profile.allergies.slice(0, 10).join(', ')}`);
    }
    if (profile.medications?.length) {
        const meds = profile.medications.slice(0, 10).map(m => {
            let str = m.name;
            if (m.dose) str += ` (${m.dose})`;
            return str;
        });
        lines.push(`Лекарства: ${meds.join(', ')}`);
    }

    // Notes (truncated)
    if (profile.notes) {
        const truncated = profile.notes.length > 500
            ? profile.notes.substring(0, 500) + '...'
            : profile.notes;
        lines.push(`Заметки врача: ${truncated}`);
    }

    lines.push('=========================');
    return lines.join('\n');
}
