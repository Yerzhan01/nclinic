'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2, Save, Plus, X } from 'lucide-react';

import { usePatientProfile, useUpdatePatientProfile } from '@/hooks/usePatientProfile';
import { useProgramTemplates } from '@/hooks/usePatients';
import type { PatientProfile, Medication } from '@/types/api';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
    patientId: string;
}

export function PatientProfileCard({ patientId }: Props) {
    const { data: profile, isLoading } = usePatientProfile(patientId);
    const { data: templates } = useProgramTemplates();
    const updateProfile = useUpdatePatientProfile();

    const [goals, setGoals] = useState<string[]>([]);
    const [diagnoses, setDiagnoses] = useState<string[]>([]);
    const [allergies, setAllergies] = useState<string[]>([]);
    const [medications, setMedications] = useState<Medication[]>([]);
    const [preferences, setPreferences] = useState<string[]>([]);
    const [restrictions, setRestrictions] = useState<string[]>([]);

    const { register, handleSubmit, setValue, watch } = useForm<PatientProfile>();

    // Sync form with fetched profile
    useEffect(() => {
        if (profile) {
            setValue('heightCm', profile.heightCm);
            setValue('weightKg', profile.weightKg);
            setValue('targetWeightKg', profile.targetWeightKg);
            setValue('activityLevel', profile.activityLevel);
            setValue('notes', profile.notes);
            setValue('nutritionPlan.kcalTarget', profile.nutritionPlan?.kcalTarget);
            setValue('nutritionPlan.proteinG', profile.nutritionPlan?.proteinG);
            setValue('nutritionPlan.fatG', profile.nutritionPlan?.fatG);
            setValue('nutritionPlan.carbsG', profile.nutritionPlan?.carbsG);
            setValue('nutritionPlan.notes', profile.nutritionPlan?.notes);
            setValue('program.templateId', profile.program?.templateId);
            setValue('program.name', profile.program?.name);

            setGoals(profile.goals || []);
            setDiagnoses(profile.diagnoses || []);
            setAllergies(profile.allergies || []);
            setMedications(profile.medications || []);
            setPreferences(profile.nutritionPlan?.preferences || []);
            setRestrictions(profile.nutritionPlan?.restrictions || []);
        }
    }, [profile, setValue]);

    const onSubmit = async (data: PatientProfile) => {
        try {
            await updateProfile.mutateAsync({
                patientId,
                patch: {
                    ...data,
                    goals,
                    diagnoses,
                    allergies,
                    medications,
                    nutritionPlan: {
                        ...data.nutritionPlan,
                        preferences,
                        restrictions,
                    },
                },
            });
            toast.success('Профиль сохранен');
        } catch {
            toast.error('Ошибка сохранения');
        }
    };

    // Tag input helpers
    const addTag = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
        if (value.trim()) {
            setter(prev => [...prev, value.trim()]);
        }
    };

    const removeTag = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
        setter(prev => prev.filter((_, i) => i !== index));
    };

    const addMedication = () => {
        setMedications(prev => [...prev, { name: '', dose: '', frequency: '' }]);
    };

    const removeMedication = (index: number) => {
        setMedications(prev => prev.filter((_, i) => i !== index));
    };

    const updateMedication = (index: number, field: keyof Medication, value: string) => {
        setMedications(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Профиль пациента</CardTitle>
                <CardDescription>Структурированные данные для AI-контекста</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Anthropometry */}
                    <div className="space-y-3">
                        <h4 className="font-medium">Антропометрия</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <Label>Рост (см)</Label>
                                <Input type="number" {...register('heightCm', { valueAsNumber: true })} />
                            </div>
                            <div>
                                <Label>Вес (кг)</Label>
                                <Input type="number" step="0.1" {...register('weightKg', { valueAsNumber: true })} />
                            </div>
                            <div>
                                <Label>Цель (кг)</Label>
                                <Input type="number" step="0.1" {...register('targetWeightKg', { valueAsNumber: true })} />
                            </div>
                            <div>
                                <Label>Активность</Label>
                                <Select
                                    value={watch('activityLevel') || ''}
                                    onValueChange={v => setValue('activityLevel', v as PatientProfile['activityLevel'])}
                                >
                                    <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Низкая</SelectItem>
                                        <SelectItem value="medium">Средняя</SelectItem>
                                        <SelectItem value="high">Высокая</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Goals */}
                    <div className="space-y-2">
                        <Label>Цели</Label>
                        <div className="flex flex-wrap gap-1 mb-2">
                            {goals.map((g, i) => (
                                <Badge key={i} variant="secondary" className="gap-1">
                                    {g}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(setGoals, i)} />
                                </Badge>
                            ))}
                        </div>
                        <Input
                            placeholder="Добавить цель (Enter)"
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addTag(setGoals, e.currentTarget.value);
                                    e.currentTarget.value = '';
                                }
                            }}
                        />
                    </div>

                    {/* Program */}
                    <div className="space-y-2">
                        <Label>Программа</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <Select
                                value={watch('program.templateId') || ''}
                                onValueChange={v => {
                                    setValue('program.templateId', v);
                                    const t = templates?.find(t => t.id === v);
                                    if (t) setValue('program.name', t.name);
                                }}
                            >
                                <SelectTrigger><SelectValue placeholder="Шаблон" /></SelectTrigger>
                                <SelectContent>
                                    {templates?.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input placeholder="Название" {...register('program.name')} />
                        </div>
                    </div>

                    {/* Nutrition Plan */}
                    <div className="space-y-3">
                        <h4 className="font-medium">План питания</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <Label>Ккал</Label>
                                <Input type="number" {...register('nutritionPlan.kcalTarget', { valueAsNumber: true })} />
                            </div>
                            <div>
                                <Label>Белок (г)</Label>
                                <Input type="number" {...register('nutritionPlan.proteinG', { valueAsNumber: true })} />
                            </div>
                            <div>
                                <Label>Жиры (г)</Label>
                                <Input type="number" {...register('nutritionPlan.fatG', { valueAsNumber: true })} />
                            </div>
                            <div>
                                <Label>Углеводы (г)</Label>
                                <Input type="number" {...register('nutritionPlan.carbsG', { valueAsNumber: true })} />
                            </div>
                        </div>

                        {/* Preferences */}
                        <div className="space-y-2">
                            <Label>Предпочтения</Label>
                            <div className="flex flex-wrap gap-1 mb-2">
                                {preferences.map((p, i) => (
                                    <Badge key={i} variant="outline" className="gap-1">
                                        {p}
                                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(setPreferences, i)} />
                                    </Badge>
                                ))}
                            </div>
                            <Input
                                placeholder="Добавить (Enter)"
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addTag(setPreferences, e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                        </div>

                        {/* Restrictions */}
                        <div className="space-y-2">
                            <Label>Ограничения</Label>
                            <div className="flex flex-wrap gap-1 mb-2">
                                {restrictions.map((r, i) => (
                                    <Badge key={i} variant="destructive" className="gap-1">
                                        {r}
                                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(setRestrictions, i)} />
                                    </Badge>
                                ))}
                            </div>
                            <Input
                                placeholder="Добавить (Enter)"
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addTag(setRestrictions, e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                        </div>

                        <div>
                            <Label>Заметки по питанию</Label>
                            <Textarea {...register('nutritionPlan.notes')} />
                        </div>
                    </div>

                    {/* Medical */}
                    <div className="space-y-3">
                        <h4 className="font-medium">Медицинские данные</h4>

                        {/* Diagnoses */}
                        <div className="space-y-2">
                            <Label>Диагнозы</Label>
                            <div className="flex flex-wrap gap-1 mb-2">
                                {diagnoses.map((d, i) => (
                                    <Badge key={i} variant="secondary" className="gap-1">
                                        {d}
                                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(setDiagnoses, i)} />
                                    </Badge>
                                ))}
                            </div>
                            <Input
                                placeholder="Добавить (Enter)"
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addTag(setDiagnoses, e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                        </div>

                        {/* Allergies */}
                        <div className="space-y-2">
                            <Label>Аллергии</Label>
                            <div className="flex flex-wrap gap-1 mb-2">
                                {allergies.map((a, i) => (
                                    <Badge key={i} variant="destructive" className="gap-1">
                                        {a}
                                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(setAllergies, i)} />
                                    </Badge>
                                ))}
                            </div>
                            <Input
                                placeholder="Добавить (Enter)"
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addTag(setAllergies, e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                        </div>

                        {/* Medications */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Лекарства</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addMedication}>
                                    <Plus className="h-4 w-4 mr-1" /> Добавить
                                </Button>
                            </div>
                            {medications.map((m, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <Input
                                        placeholder="Название"
                                        value={m.name}
                                        onChange={e => updateMedication(i, 'name', e.target.value)}
                                    />
                                    <Input
                                        placeholder="Доза"
                                        value={m.dose || ''}
                                        onChange={e => updateMedication(i, 'dose', e.target.value)}
                                        className="w-24"
                                    />
                                    <Input
                                        placeholder="Частота"
                                        value={m.frequency || ''}
                                        onChange={e => updateMedication(i, 'frequency', e.target.value)}
                                        className="w-32"
                                    />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeMedication(i)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* General Notes */}
                    <div className="space-y-2">
                        <Label>Общие заметки врача</Label>
                        <Textarea
                            {...register('notes')}
                            placeholder="Важная информация для AI-контекста (до 800 символов)"
                            maxLength={800}
                        />
                    </div>

                    {/* Submit */}
                    <Button type="submit" disabled={updateProfile.isPending} className="w-full">
                        {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Сохранить профиль
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
