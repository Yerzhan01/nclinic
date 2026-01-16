import { z } from 'zod';

/**
 * Medication entry schema
 */
export const MedicationSchema = z.object({
    name: z.string().min(1),
    dose: z.string().optional(),
    frequency: z.string().optional(),
});

/**
 * Program reference schema
 */
export const ProgramRefSchema = z.object({
    templateId: z.string().optional(),
    name: z.string().optional(),
});

/**
 * Nutrition plan schema
 */
export const NutritionPlanSchema = z.object({
    kcalTarget: z.number().positive().optional(),
    proteinG: z.number().nonnegative().optional(),
    fatG: z.number().nonnegative().optional(),
    carbsG: z.number().nonnegative().optional(),
    preferences: z.array(z.string()).max(10).optional(),
    restrictions: z.array(z.string()).max(10).optional(),
    notes: z.string().max(500).optional(),
});

/**
 * Activity level enum
 */
export const ActivityLevelSchema = z.enum(['low', 'medium', 'high']);

/**
 * Full Patient Profile schema
 */
export const PatientProfileSchema = z.object({
    // Anthropometry
    heightCm: z.number().positive().optional(),
    weightKg: z.number().positive().optional(),
    targetWeightKg: z.number().positive().optional(),
    activityLevel: ActivityLevelSchema.optional(),

    // Goals
    goals: z.array(z.string()).max(10).optional(),

    // Medical
    diagnoses: z.array(z.string()).max(10).optional(),
    allergies: z.array(z.string()).max(10).optional(),
    medications: z.array(MedicationSchema).max(20).optional(),

    // Program
    program: ProgramRefSchema.optional(),

    // Nutrition plan
    nutritionPlan: NutritionPlanSchema.optional(),

    // General notes
    notes: z.string().max(800).optional(),
});

/**
 * Patch schema - all fields optional for partial updates
 */
export const PatientProfilePatchSchema = PatientProfileSchema.partial();

// Type exports
export type PatientProfile = z.infer<typeof PatientProfileSchema>;
export type PatientProfilePatch = z.infer<typeof PatientProfilePatchSchema>;
export type Medication = z.infer<typeof MedicationSchema>;
export type NutritionPlan = z.infer<typeof NutritionPlanSchema>;
export type ActivityLevel = z.infer<typeof ActivityLevelSchema>;
