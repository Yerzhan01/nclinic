"use client";

import { useProgram, useUpdateProgram } from "@/hooks/usePrograms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, ArrowLeft, Plus, Trash, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ProgramActivity, ProgramTemplateRules } from "@/api/programs.api";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";

// Helper to get day name/number
const getDayLabel = (day: number) => `Day ${day}`;

// Slot ordering
// Slot ordering
const SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'];

const SLOT_LABELS: Record<string, string> = {
    MORNING: 'Утро',
    AFTERNOON: 'День',
    EVENING: 'Вечер',
};

const TYPE_LABELS: Record<string, string> = {
    WEIGHT: 'Вес',
    MOOD: 'Настроение',
    MEALS: 'Питание',
    STEPS: 'Шаги',
    DIET_ADHERENCE: 'Диета',
    VISIT: 'Визит',
    CUSTOM: 'Другое',
};

import { use } from "react";

export default function ProgramEditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { data: program, isLoading } = useProgram(id);
    const updateProgram = useUpdateProgram();

    // Form State
    const [name, setName] = useState("");
    const [duration, setDuration] = useState(42);
    const [isActive, setIsActive] = useState(true);
    const [rules, setRules] = useState<ProgramTemplateRules>({ schedule: [] });
    const [hasChanges, setHasChanges] = useState(false);

    // Activity Dialog State
    const [isActivityOpen, setIsActivityOpen] = useState(false);
    const [editingDay, setEditingDay] = useState<number | null>(null);
    const [editingActivityIndex, setEditingActivityIndex] = useState<number | null>(null);
    const [currentActivity, setCurrentActivity] = useState<Partial<ProgramActivity>>({
        slot: 'MORNING',
        time: '09:00',
        type: 'WEIGHT',
        question: '',
        required: true,
    });

    // Load data
    useEffect(() => {
        if (program) {
            setName(program.name);
            setDuration(program.durationDays || 42);
            setIsActive(program.isActive);
            // Ensure rules structure exists
            setRules(program.rules && program.rules.schedule ? program.rules : { schedule: [] });
        }
    }, [program]);

    // Handle Save
    const handleSave = async () => {
        try {
            await updateProgram.mutateAsync({
                id: id,
                data: {
                    name,
                    durationDays: duration,
                    isActive,
                    rules,
                },
            });
            toast.success("Program saved successfully");
            setHasChanges(false);
        } catch (error) {
            toast.error("Failed to save changes");
        }
    };

    // Repeat Mode State
    const [repeatMode, setRepeatMode] = useState<'NONE' | 'ALL_DAYS' | 'WEEKLY'>('NONE');

    // Handle Save Activity
    const handleSaveActivity = () => {
        if (!editingDay || !currentActivity.time || !currentActivity.question) return;

        const newActivity = currentActivity as ProgramActivity;

        setRules(prev => {
            const schedule = [...prev.schedule];

            // Determine target days
            let targetDays: number[] = [editingDay];

            if (repeatMode === 'ALL_DAYS') {
                targetDays = Array.from({ length: duration }, (_, i) => i + 1);
            } else if (repeatMode === 'WEEKLY') {
                // Every 7 days from current day
                targetDays = [];
                for (let d = editingDay; d <= duration; d += 7) {
                    targetDays.push(d);
                }
            }

            // Apply to all target days
            targetDays.forEach(day => {
                const dayIndex = schedule.findIndex(s => s.day === day);

                if (dayIndex > -1) {
                    // Update existing day
                    // Check if we are editing an existing activity and this is the original day
                    if (day === editingDay && editingActivityIndex !== null && repeatMode === 'NONE') {
                        schedule[dayIndex].activities[editingActivityIndex] = newActivity;
                    } else {
                        // Append new activity
                        // Optionally check for duplicates? relying on user for now
                        schedule[dayIndex] = {
                            ...schedule[dayIndex],
                            activities: [...schedule[dayIndex].activities, newActivity]
                        };
                    }
                } else {
                    // Create new day entry
                    schedule.push({
                        day: day,
                        activities: [newActivity]
                    });
                }
            });

            // Sort schedule by day
            schedule.sort((a, b) => a.day - b.day);
            return { schedule };
        });

        setIsActivityOpen(false);
        setHasChanges(true);
        resetActivityForm();
    };

    const removeActivity = (day: number, activityIndex: number) => {
        setRules(prev => {
            const schedule = [...prev.schedule];
            const dayIndex = schedule.findIndex(s => s.day === day);
            if (dayIndex > -1) {
                const activities = [...schedule[dayIndex].activities];
                activities.splice(activityIndex, 1);

                if (activities.length === 0) {
                    // Remove day if empty
                    schedule.splice(dayIndex, 1);
                } else {
                    schedule[dayIndex].activities = activities;
                }
            }
            return { schedule };
        });
        setHasChanges(true);
    };

    const resetActivityForm = () => {
        setCurrentActivity({
            slot: 'MORNING',
            time: '09:00',
            type: 'WEIGHT',
            question: '',
            required: true,
        });
        setEditingDay(null);
        setEditingActivityIndex(null);
        setRepeatMode('NONE');
    };

    const openAddActivity = (day: number) => {
        setEditingDay(day);
        setEditingActivityIndex(null);
        setIsActivityOpen(true);
    };

    const openEditActivity = (day: number, index: number, activity: ProgramActivity) => {
        setEditingDay(day);
        setEditingActivityIndex(index);
        setCurrentActivity({ ...activity });
        setIsActivityOpen(true);
    };

    if (isLoading) return <div className="p-8 flex items-center gap-2"><Loader2 className="animate-spin" /> Loading...</div>;
    if (!program) return <div className="p-8">Program not found</div>;

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex justify-between items-center sticky top-0 bg-background/95 backdrop-blur z-10 py-4 border-b">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">{name}</h2>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant={isActive ? "default" : "secondary"}>
                                {isActive ? "Активен" : "Черновик"}
                            </Badge>
                            <span>• {duration} дней</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={updateProgram.isPending || !hasChanges}>
                        {updateProgram.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Сохранить изменения
                    </Button>
                </div>
            </div>

            {/* Basic Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 h-fit">
                    <CardHeader><CardTitle>Настройки</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Название программы</Label>
                            <Input value={name} onChange={e => { setName(e.target.value); setHasChanges(true); }} />
                        </div>
                        <div className="space-y-2">
                            <Label>Длительность (дней)</Label>
                            <Input type="number" value={duration} onChange={e => { setDuration(Number(e.target.value)); setHasChanges(true); }} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Статус активности</Label>
                            <Switch checked={isActive} onCheckedChange={v => { setIsActive(v); setHasChanges(true); }} />
                        </div>
                    </CardContent>
                </Card>

                {/* Schedule Editor */}
                <Card className="md:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Расписание</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {Array.from({ length: duration }).map((_, i) => {
                                const dayNum = i + 1;
                                const daySchedule = rules.schedule.find(s => s.day === dayNum);
                                const hasActivities = daySchedule && daySchedule.activities.length > 0;

                                return (
                                    <div key={dayNum} className="group relative border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                                День {dayNum}
                                                {hasActivities && <Badge variant="outline" className="text-xs">{daySchedule.activities.length} Заданий</Badge>}
                                            </h3>
                                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100" onClick={() => openAddActivity(dayNum)}>
                                                <Plus className="h-4 w-4 mr-1" /> Добавить
                                            </Button>
                                        </div>

                                        {hasActivities ? (
                                            <div className="grid gap-3">
                                                {daySchedule.activities.map((act, idx) => (
                                                    <div key={idx} className="flex items-start gap-3 bg-white border p-3 rounded shadow-sm hover:border-primary/50 transition-colors cursor-pointer" onClick={() => openEditActivity(dayNum, idx, act)}>
                                                        <Badge variant="secondary" className="mt-1">{act.time}</Badge>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-sm text-blue-600 uppercase">
                                                                    {SLOT_LABELS[act.slot] || act.slot}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">• {TYPE_LABELS[act.type] || act.type}</span>
                                                                {act.required && <Badge className="text-[10px] h-4 px-1" variant="destructive">ОБЯЗ</Badge>}
                                                            </div>
                                                            <p className="text-sm mt-1">{act.question}</p>
                                                        </div>
                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-red-500" onClick={(e) => { e.stopPropagation(); removeActivity(dayNum, idx); }}>
                                                            <Trash className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground italic py-2 border-t border-dashed">
                                                Нет запланированных заданий.
                                                <Button variant="link" size="sm" className="h-auto p-0 ml-2" onClick={() => openAddActivity(dayNum)}>Добавить</Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Add/Edit Activity Dialog */}
            <Dialog open={isActivityOpen} onOpenChange={setIsActivityOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingActivityIndex !== null ? 'Редактировать задание' : 'Добавить задание'} (День {editingDay})
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Время суток</Label>
                                <Select
                                    value={currentActivity.slot}
                                    onValueChange={(v: any) => setCurrentActivity(prev => ({ ...prev, slot: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SLOTS.map(s => <SelectItem key={s} value={s}>{SLOT_LABELS[s] || s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Время</Label>
                                <div className="relative">
                                    <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        type="time"
                                        value={currentActivity.time}
                                        onChange={e => setCurrentActivity(prev => ({ ...prev, time: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Тип задания</Label>
                            <Select
                                value={currentActivity.type}
                                onValueChange={(v: any) => setCurrentActivity(prev => ({ ...prev, type: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="WEIGHT">Вес</SelectItem>
                                    <SelectItem value="MOOD">Настроение</SelectItem>
                                    <SelectItem value="MEALS">Питание</SelectItem>
                                    <SelectItem value="STEPS">Шаги</SelectItem>
                                    <SelectItem value="DIET_ADHERENCE">Соблюдение диеты</SelectItem>
                                    <SelectItem value="VISIT">Визит в клинику</SelectItem>
                                    <SelectItem value="CUSTOM">Другое</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Текст вопроса / Напоминания</Label>
                            <Textarea
                                placeholder="Что должен спросить бот?"
                                value={currentActivity.question}
                                onChange={e => setCurrentActivity(prev => ({ ...prev, question: e.target.value }))}
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 pt-2">
                                <Switch
                                    checked={currentActivity.required}
                                    onCheckedChange={v => setCurrentActivity(prev => ({ ...prev, required: v }))}
                                />
                                <Label>Требуется ответ?</Label>
                            </div>

                            <div className="space-y-2">
                                <Label>Повторение</Label>
                                <Select
                                    value={repeatMode}
                                    onValueChange={(v: any) => setRepeatMode(v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">Без повторения</SelectItem>
                                        <SelectItem value="ALL_DAYS">Во все дни</SelectItem>
                                        <SelectItem value="WEEKLY">Каждую неделю</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveActivity} disabled={!currentActivity.question}>
                            {editingActivityIndex !== null ? 'Сохранить' : 'Добавить'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
