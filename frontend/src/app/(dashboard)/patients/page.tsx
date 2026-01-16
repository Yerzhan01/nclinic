'use client';

import { useState, useEffect } from 'react';
import { usePatients, usePatient } from '@/hooks/usePatients';
import { useActiveProgram } from '@/hooks/useProgram';
import { useMessages, useSendMessage } from '@/hooks/useMessages';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, MessageSquare, ClipboardList, Calendar, Send, User } from 'lucide-react';
import Link from 'next/link';
import type { ChatMode } from '@/types/api';
import { CreatePatientDialog } from '@/components/patients/CreatePatientDialog';
import { AIToggle } from '@/components/patients/AIToggle';
import { cn } from '@/lib/utils';

function ChatModeBadge({ mode }: { mode: ChatMode }) {
    const variants: Record<ChatMode, 'default' | 'secondary' | 'destructive'> = {
        AI: 'default',
        HUMAN: 'secondary',
        PAUSED: 'destructive',
    };
    return <Badge variant={variants[mode]}>{mode}</Badge>;
}

function PatientListItem({
    patient,
    isSelected,
    onClick
}: {
    patient: { id: string; fullName: string; phone: string; chatMode: ChatMode };
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "p-3 border-b cursor-pointer hover:bg-accent transition-colors",
                isSelected && "bg-accent border-l-2 border-l-primary"
            )}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-sm">{patient.fullName}</p>
                        <p className="text-xs text-muted-foreground">{patient.phone}</p>
                    </div>
                </div>
                <ChatModeBadge mode={patient.chatMode} />
            </div>
        </div>
    );
}

function PatientPreview({ patientId }: { patientId: string }) {
    const { data: patient, isLoading: patientLoading } = usePatient(patientId);
    const { data: program } = useActiveProgram(patientId);
    const { data: messages = [] } = useMessages(patientId);
    const sendMessage = useSendMessage(patientId);
    const [newMessage, setNewMessage] = useState('');

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        await sendMessage.mutateAsync(newMessage);
        setNewMessage('');
    };

    if (patientLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Skeleton className="h-8 w-32" />
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
                Пациент не найден
            </div>
        );
    }

    const programDay = program
        ? Math.ceil((Date.now() - new Date(program.startDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    const recentMessages = messages.slice(-5);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">{patient.fullName}</h2>
                            <p className="text-sm text-muted-foreground">{patient.phone}</p>
                        </div>
                    </div>
                    <Link href={`/patients/${patientId}`}>
                        <Button variant="outline" size="sm">Подробнее</Button>
                    </Link>
                </div>

                {program && (
                    <div className="text-sm bg-muted p-2 rounded">
                        📋 {program.template?.name} — День {programDay} из {program.template?.durationDays}
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="p-3 border-b flex gap-2">
                <Link href={`/patients/${patientId}?tab=chat`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1">
                        <MessageSquare className="h-4 w-4" /> Чат
                    </Button>
                </Link>
                <Link href={`/patients/${patientId}?tab=calendar`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1">
                        <Calendar className="h-4 w-4" /> Чекины
                    </Button>
                </Link>
                <Link href={`/patients/${patientId}?tab=tasks`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1">
                        <ClipboardList className="h-4 w-4" /> Задачи
                    </Button>
                </Link>
            </div>

            {/* AI Toggle */}
            <div className="p-3 border-b">
                <AIToggle patientId={patientId} />
            </div>

            {/* Recent Messages */}
            <ScrollArea className="flex-1 p-3">
                <h3 className="text-sm font-medium mb-2">Последние сообщения</h3>
                {recentMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нет сообщений</p>
                ) : (
                    <div className="space-y-2">
                        {recentMessages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "p-2 rounded text-sm",
                                    msg.sender === 'PATIENT'
                                        ? "bg-muted"
                                        : "bg-primary/10"
                                )}
                            >
                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                    <span>{msg.sender === 'PATIENT' ? patient.fullName : msg.sender}</span>
                                    <span>{new Date(msg.createdAt).toLocaleTimeString('ru')}</span>
                                </div>
                                <p>{msg.content || '[медиа]'}</p>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Quick Reply */}
            <div className="p-3 border-t">
                <div className="flex gap-2">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Быстрый ответ..."
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <Button onClick={handleSendMessage} disabled={sendMessage.isPending}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function PatientsPage() {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    const { data: patients = [], isLoading } = usePatients(debouncedSearch);

    // Auto-select first patient when list loads
    useEffect(() => {
        if (patients.length > 0 && !selectedPatientId) {
            setSelectedPatientId(patients[0].id);
        }
    }, [patients, selectedPatientId]);

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold">Пациенты</h1>
                    <p className="text-muted-foreground">Управление пациентами</p>
                </div>
                <CreatePatientDialog />
            </div>

            {/* Search */}
            <div className="mb-4">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Поиск по имени или телефону..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Split View */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Patient List (Left) */}
                <Card className="w-80 flex-shrink-0">
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm">Список пациентов ({patients.length})</CardTitle>
                    </CardHeader>
                    <ScrollArea className="h-[calc(100%-52px)]">
                        {isLoading ? (
                            <div className="p-3 space-y-2">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Skeleton key={i} className="h-16 w-full" />
                                ))}
                            </div>
                        ) : patients.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">
                                {search ? 'Пациенты не найдены' : 'Нет пациентов'}
                            </div>
                        ) : (
                            patients.map((patient) => (
                                <PatientListItem
                                    key={patient.id}
                                    patient={patient}
                                    isSelected={patient.id === selectedPatientId}
                                    onClick={() => setSelectedPatientId(patient.id)}
                                />
                            ))
                        )}
                    </ScrollArea>
                </Card>

                {/* Patient Preview (Right) */}
                <Card className="flex-1 min-w-0">
                    {selectedPatientId ? (
                        <PatientPreview patientId={selectedPatientId} />
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <User className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                <p>Выберите пациента из списка</p>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
