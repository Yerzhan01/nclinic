'use client';

import { use, useState } from 'react';
import { usePatient, useUpdatePatient } from '@/hooks/usePatients';
import { useActiveProgram, useProgramTemplates, useAssignProgram, usePauseProgram } from '@/hooks/useProgram';
import { useMessages, useSendMessage } from '@/hooks/useMessages';
import { useAlerts, useResolveAlert } from '@/hooks/useAlerts';
import { usePatientTasks, useCreateTask } from '@/hooks/useTasks';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ArrowLeft,
    Send,
    CheckCircle,
    AlertTriangle,
    Clock,
    MessageSquare,
    Calendar,
    CalendarDays,
    ClipboardList,
    MoreVertical,
    Play,
    Pause,
    RefreshCw,
    User,
} from 'lucide-react';
import Link from 'next/link';
import type { ChatMode, Slot, CheckInStatus, AlertLevel, TaskPriority, TaskStatus } from '@/types/api';
import { PatientProfileCard } from '@/components/patients/PatientProfileCard';
import { PatientTimeline } from '@/components/patients/PatientTimeline';
import { AIToggle } from '@/components/patients/AIToggle';
import { PatientTasksCard } from '@/components/patients/PatientTasksCard';
import { EngagementCard } from '@/components/engagement/EngagementCard';
import { CheckInCalendar } from '@/components/patients/CheckInCalendar';

// Badge components
function ChatModeBadge({ mode }: { mode: ChatMode }) {
    const config: Record<ChatMode, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
        AI: { variant: 'default', label: 'AI' },
        HUMAN: { variant: 'secondary', label: 'HUMAN' },
        PAUSED: { variant: 'destructive', label: 'PAUSED' },
    };
    return <Badge variant={config[mode].variant}>{config[mode].label}</Badge>;
}

function AlertLevelBadge({ level }: { level: AlertLevel }) {
    const variants: Record<AlertLevel, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        LOW: 'outline',
        MEDIUM: 'secondary',
        HIGH: 'default',
        CRITICAL: 'destructive',
    };
    return <Badge variant={variants[level]}>{level}</Badge>;
}

function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
    const variants: Record<TaskPriority, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        LOW: 'outline',
        NORMAL: 'secondary',
        HIGH: 'default',
        URGENT: 'destructive',
    };
    return <Badge variant={variants[priority]}>{priority}</Badge>;
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
    const config: Record<TaskStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
        OPEN: { variant: 'outline', label: 'Открыта' },
        IN_PROGRESS: { variant: 'secondary', label: 'В работе' },
        DONE: { variant: 'default', label: 'Готово' },
        CANCELLED: { variant: 'destructive', label: 'Отменена' },
    };
    return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
}

function CheckInStatusBadge({ status }: { status: CheckInStatus }) {
    const config: Record<CheckInStatus, { icon: React.ReactNode; label: string; className: string }> = {
        PENDING: { icon: <Clock className="h-4 w-4" />, label: 'Ждем ответа', className: 'text-muted-foreground' },
        RECEIVED: { icon: <CheckCircle className="h-4 w-4" />, label: 'Получен', className: 'text-green-600' },
        MISSED: { icon: <AlertTriangle className="h-4 w-4" />, label: 'Пропущен', className: 'text-red-600' },
        ESCALATED: { icon: <AlertTriangle className="h-4 w-4" />, label: 'Эскалирован', className: 'text-orange-600' },
    };
    const { icon, label, className } = config[status];
    return (
        <div className={`flex items-center gap-1 ${className}`}>
            {icon}
            <span className="text-xs">{label}</span>
        </div>
    );
}

const slotLabels: Record<Slot, string> = {
    MORNING: 'Утро',
    AFTERNOON: 'День',
    EVENING: 'Вечер',
};

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [message, setMessage] = useState('');

    const { data: patient, isLoading: patientLoading } = usePatient(id);
    const { data: program, isLoading: programLoading } = useActiveProgram(id);
    const { data: messages = [], isLoading: messagesLoading } = useMessages(id);
    const { data: alerts = [] } = useAlerts(id);
    const { data: tasks = [] } = usePatientTasks(id);

    const sendMessage = useSendMessage(id);
    const updatePatient = useUpdatePatient();
    const resolveAlert = useResolveAlert();
    const createTask = useCreateTask();
    const pauseProgram = usePauseProgram();
    const assignProgram = useAssignProgram();
    const { data: templates = [] } = useProgramTemplates();

    const [showTaskDialog, setShowTaskDialog] = useState(false);
    const [taskTitle, setTaskTitle] = useState('');
    const [showAssignDialog, setShowAssignDialog] = useState(false);

    const handleToggleChatMode = async () => {
        if (!patient) return;
        const newMode: ChatMode = patient.chatMode === 'AI' ? 'HUMAN' : 'AI';

        try {
            await updatePatient.mutateAsync({
                id: patient.id,
                data: { chatMode: newMode }
            });
            toast.success(`Режим переключен на ${newMode}`);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleSendMessage = async () => {
        if (!message.trim()) return;
        try {
            await sendMessage.mutateAsync(message);
            setMessage('');
            toast.success('Сообщение отправлено');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleResolveAlert = async (alertId: string) => {
        try {
            await resolveAlert.mutateAsync({ alertId });
            toast.success('Алерт закрыт, пациент переведён в AI режим');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleSendReminder = async () => {
        try {
            await sendMessage.mutateAsync('Напоминаем о необходимости отметиться сегодня! 📊');
            toast.success('Напоминание отправлено');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleCreateTask = async () => {
        if (!taskTitle.trim()) return;
        try {
            await createTask.mutateAsync({
                patientId: id,
                type: 'CUSTOM',
                title: taskTitle,
                priority: 'MEDIUM',
            });
            setTaskTitle('');
            setShowTaskDialog(false);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handlePauseProgram = async () => {
        try {
            await pauseProgram.mutateAsync({ patientId: id, paused: true });
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleAssignProgram = async (templateId: string) => {
        try {
            await assignProgram.mutateAsync({ patientId: id, templateId });
            setShowAssignDialog(false);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };


    if (patientLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Пациент не найден</p>
                <Link href="/patients">
                    <Button variant="link">Вернуться к списку</Button>
                </Link>
            </div>
        );
    }

    const activeAlerts = alerts.filter((a) => a.status !== 'RESOLVED');
    const activeTasks = tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
    const todayCheckIns = program?.checkIns?.filter((c) => c.dayNumber === program.currentDay) || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/patients">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">{patient.fullName}</h1>
                        <p className="text-muted-foreground">{patient.phone}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <AIToggle patientId={id} />
                    <ChatModeBadge mode={patient.chatMode} />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleChatMode}
                        disabled={updatePatient.isPending}
                    >
                        {patient.chatMode === 'AI' ? 'Переключить на HUMAN' : 'Вернуть AI'}
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Быстрые действия</DropdownMenuLabel>
                            <DropdownMenuItem onClick={handleSendReminder}>
                                <Send className="mr-2 h-4 w-4" /> Отправить напоминание
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowTaskDialog(true)}>
                                <ClipboardList className="mr-2 h-4 w-4" /> Создать задачу
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handlePauseProgram} disabled={!program}>
                                <Pause className="mr-2 h-4 w-4" /> Пауза программы
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Program Progress (if active) */}
            {program && (
                <div className="bg-card border rounded-lg p-4 flex items-center gap-4">
                    <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">Прогресс программы: {program.template?.name}</span>
                            <span className="text-muted-foreground">{program.currentDay} / {program.template?.durationDays || 30} дн.</span>
                        </div>
                        <Progress value={(program.currentDay / (program.template?.durationDays || 30)) * 100} className="h-2" />
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Программа
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {program ? (
                            <div>
                                <p className="text-lg font-bold">День {program.currentDay}</p>
                                <p className="text-xs text-muted-foreground">{program.template?.name}</p>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">Нет активной программы</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Алерты
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg font-bold">{activeAlerts.length}</p>
                        <p className="text-xs text-muted-foreground">Активных</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Задачи
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg font-bold">{activeTasks.length}</p>
                        <p className="text-xs text-muted-foreground">В работе</p>
                    </CardContent>
                </Card>
                <EngagementCard patientId={id} />
            </div>

            {/* Tabs */}
            <Tabs defaultValue="chat">
                <TabsList>
                    <TabsTrigger value="program" className="gap-2">
                        <Calendar className="h-4 w-4" />
                        Программа
                    </TabsTrigger>
                    <TabsTrigger value="chat" className="gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Чат
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Алерты
                        {activeAlerts.length > 0 && (
                            <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                                {activeAlerts.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Задачи
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Календарь
                    </TabsTrigger>
                    <TabsTrigger value="profile" className="gap-2">
                        <User className="h-4 w-4" />
                        Профиль
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Хронология
                    </TabsTrigger>
                </TabsList>

                {/* Timeline Tab */}
                <TabsContent value="timeline" className="space-y-4">
                    <PatientTimeline patientId={id} />
                </TabsContent>

                {/* Program Tab */}
                <TabsContent value="program" className="space-y-4">
                    {programLoading ? (
                        <Skeleton className="h-32 w-full" />
                    ) : program ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>День {program.currentDay}</CardTitle>
                                <CardDescription>{program.template?.name}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-4 md:grid-cols-3">
                                    {(['MORNING', 'AFTERNOON', 'EVENING'] as Slot[]).map((slot) => {
                                        const checkIn = todayCheckIns.find((c) => c.slot === slot);
                                        return (
                                            <div key={slot} className="p-4 border rounded-lg">
                                                <p className="font-medium mb-1">{slotLabels[slot]}</p>
                                                {checkIn ? (
                                                    <div>
                                                        {checkIn.title && (
                                                            <p className="text-sm font-semibold mb-2">{checkIn.title}</p>
                                                        )}
                                                        <CheckInStatusBadge status={checkIn.status} />
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground">Нет активностей</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="py-8 text-center">
                                <p className="text-muted-foreground">Активная программа не найдена</p>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="mt-4">
                                            <Play className="mr-2 h-4 w-4" /> Назначить программу
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuLabel>Выберите шаблон</DropdownMenuLabel>
                                        {templates.length === 0 ? (
                                            <DropdownMenuItem disabled>Нет доступных шаблонов</DropdownMenuItem>
                                        ) : (
                                            templates.map((template) => (
                                                <DropdownMenuItem
                                                    key={template.id}
                                                    onClick={() => handleAssignProgram(template.id)}
                                                >
                                                    {template.name} ({template.durationDays} дн.)
                                                </DropdownMenuItem>
                                            ))
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Chat Tab */}
                <TabsContent value="chat" className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Чат с пациентом</CardTitle>
                            {patient.chatMode === 'HUMAN' && (
                                <CardDescription className="text-orange-600">
                                    Пациент в HUMAN режиме — отвечает сотрудник
                                </CardDescription>
                            )}
                            {patient.chatMode === 'AI' && (
                                <CardDescription className="text-blue-600">
                                    AI режим — обычно отвечает AI, но вы можете вмешаться
                                </CardDescription>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                                {messagesLoading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <Skeleton key={i} className="h-16 w-full" />
                                    ))
                                ) : messages.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">Нет сообщений</p>
                                ) : (
                                    messages.map((msg) => {
                                        const isOutbound = msg.direction === 'OUTBOUND';

                                        // Determine media type
                                        let mediaContent = null;
                                        if (msg.mediaUrl) {
                                            const ext = msg.mediaUrl.split('.').pop()?.toLowerCase();
                                            const isAudio = msg.mediaType === 'audio' || ['ogg', 'mp3', 'wav', 'm4a', 'oga'].includes(ext || '');
                                            const isImage = msg.mediaType === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');

                                            if (isImage) {
                                                mediaContent = (
                                                    <a href={msg.mediaUrl} target="_blank" rel="noreferrer">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={msg.mediaUrl}
                                                            alt="Media"
                                                            className="rounded-md max-w-[240px] max-h-[240px] object-cover mt-2"
                                                        />
                                                    </a>
                                                );
                                            } else if (isAudio) {
                                                mediaContent = (
                                                    <audio controls className="mt-2 w-[240px]">
                                                        <source src={msg.mediaUrl} />
                                                        Audio not supported
                                                    </audio>
                                                );
                                            } else {
                                                mediaContent = (
                                                    <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline mt-2 block">
                                                        📎 Скачать файл
                                                    </a>
                                                );
                                            }
                                        }

                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] rounded-lg px-4 py-2 ${isOutbound
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-muted'
                                                        }`}
                                                >
                                                    {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}

                                                    {mediaContent}

                                                    <p className="text-xs opacity-70 mt-1 flex items-center gap-1">
                                                        {msg.sender} • {new Date(msg.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                                        {isOutbound && msg.deliveryStatus && (
                                                            <span className={`ml-1 ${msg.deliveryStatus === 'READ' ? 'text-blue-400' : ''}`}>
                                                                {msg.deliveryStatus === 'PENDING' && '⏳'}
                                                                {msg.deliveryStatus === 'SENT' && '✓'}
                                                                {msg.deliveryStatus === 'DELIVERED' && '✓✓'}
                                                                {msg.deliveryStatus === 'READ' && '✓✓'}
                                                                {msg.deliveryStatus === 'FAILED' && '⚠️'}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Textarea
                                    placeholder="Написать сообщение..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={2}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                />
                                <Button
                                    onClick={handleSendMessage}
                                    disabled={!message.trim() || sendMessage.isPending}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Alerts Tab */}
                <TabsContent value="alerts" className="space-y-4">
                    {activeAlerts.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <p className="text-muted-foreground">Нет активных алертов</p>
                            </CardContent>
                        </Card>
                    ) : (
                        activeAlerts.map((alert) => (
                            <Card key={alert.id} className={alert.level === 'CRITICAL' || alert.level === 'HIGH' ? 'border-destructive' : ''}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">{alert.title}</CardTitle>
                                        <AlertLevelBadge level={alert.level} />
                                    </div>
                                    <CardDescription>
                                        {alert.type} • {new Date(alert.createdAt).toLocaleString('ru-RU')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {alert.description && (
                                        <p className="text-sm text-muted-foreground mb-4">{alert.description}</p>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleResolveAlert(alert.id)}
                                        disabled={resolveAlert.isPending}
                                    >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Закрыть (вернуть AI)
                                    </Button>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                {/* Tasks Tab */}
                <TabsContent value="tasks" className="space-y-4">
                    <PatientTasksCard patientId={id} />
                </TabsContent>

                {/* Calendar Tab */}
                <TabsContent value="calendar" className="h-[600px]">
                    <CheckInCalendar patientId={id} programStartDate={program?.startDate} />
                </TabsContent>

                {/* Profile Tab */}
                <TabsContent value="profile">
                    <PatientProfileCard patientId={id} />
                </TabsContent>
            </Tabs>

            {/* Task Creation Dialog */}
            <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Создать задачу</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            placeholder="Название задачи..."
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
                            Отмена
                        </Button>
                        <Button onClick={handleCreateTask} disabled={!taskTitle.trim() || createTask.isPending}>
                            Создать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
