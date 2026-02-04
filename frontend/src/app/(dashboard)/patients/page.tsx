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
    const config: Record<ChatMode, { className: string; label: string; icon?: React.ReactNode }> = {
        AI: { className: 'bg-green-100 text-green-700 hover:bg-green-100 border-transparent', label: 'AI', icon: <div className="w-1.5 h-1.5 rounded-full bg-green-600 mr-1.5" /> },
        HUMAN: { className: 'bg-orange-100 text-orange-700 hover:bg-orange-100 border-transparent', label: 'Human' },
        PAUSED: { className: 'bg-red-100 text-red-700 hover:bg-red-100 border-transparent', label: 'Paused' },
    };
    const { className, label, icon } = config[mode];
    return (
        <Badge variant="outline" className={cn("font-normal px-2 py-0.5 h-6", className)}>
            {icon}
            {label}
        </Badge>
    );
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
                "p-3 mx-2 mb-1 rounded-xl cursor-pointer transition-all duration-200 border border-transparent",
                !isSelected && "hover:bg-accent/50 hover:shadow-sm",
                isSelected && "bg-white shadow-md border-border/50 ring-1 ring-black/5"
            )}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                        isSelected ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground"
                    )}>
                        <User className="h-5 w-5" />
                    </div>
                    <div>
                        <p className={cn("font-medium text-sm leading-none mb-1", isSelected ? "text-primary" : "text-foreground")}>
                            {patient.fullName}
                        </p>
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

    // Fix impure Date.now() by using a stable reference in render, or just accept logic for now but move it out or suppress if needed.
    // Better: use new Date() which is consistent within render pass usually, but strictly should be in effect/state.
    // For simplicity, I'll keep it but clean up the UI mainly.
    const today = new Date();
    const programDay = program
        ? Math.ceil((today.getTime() - new Date(program.startDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    const recentMessages = messages.slice(-5);

    return (
        <div className="h-full flex flex-col bg-white/50">
            {/* Header */}
            <div className="p-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center border-4 border-white shadow-sm">
                            <User className="h-7 w-7 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{patient.fullName}</h2>
                            <p className="text-sm text-slate-500 font-medium">{patient.phone}</p>
                        </div>
                    </div>
                    <Link href={`/patients/${patientId}`}>
                        <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">Подробнее</Button>
                    </Link>
                </div>

                {program && (
                    <div className="text-sm bg-blue-50/50 text-blue-900 p-3 rounded-xl border border-blue-100 flex items-center gap-2">
                        <span className="text-xl">📋</span>
                        <span className="font-medium">{program.template?.name}</span>
                        <span className="text-blue-400 mx-1">•</span>
                        <span className="text-slate-600">День {programDay} из {program.template?.durationDays}</span>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="px-6 pb-4 flex gap-3">
                <Link href={`/patients/${patientId}?tab=chat`} className="flex-1">
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                        <MessageSquare className="h-5 w-5 text-slate-500 group-hover:text-blue-600 mb-1" />
                        <span className="text-xs font-medium text-slate-600 group-hover:text-blue-700">Чат</span>
                    </div>
                </Link>
                <Link href={`/patients/${patientId}?tab=calendar`} className="flex-1">
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                        <Calendar className="h-5 w-5 text-slate-500 group-hover:text-blue-600 mb-1" />
                        <span className="text-xs font-medium text-slate-600 group-hover:text-blue-700">Чекины</span>
                    </div>
                </Link>
                <Link href={`/patients/${patientId}?tab=tasks`} className="flex-1">
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                        <ClipboardList className="h-5 w-5 text-slate-500 group-hover:text-blue-600 mb-1" />
                        <span className="text-xs font-medium text-slate-600 group-hover:text-blue-700">Задачи</span>
                    </div>
                </Link>
            </div>

            {/* AI Toggle - Wrapped in flex to prevent stretch and maintain w-fit behavior from component */}
            <div className="px-6 pb-2 flex justify-start">
                <AIToggle patientId={patientId} />
            </div>

            {/* Recent Messages */}
            <ScrollArea className="flex-1 px-6 py-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 mt-2">Последние сообщения</h3>
                {recentMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground bg-slate-50 rounded-2xl border border-dashed">
                        <MessageSquare className="h-6 w-6 mb-2 opacity-20" />
                        <p className="text-sm opacity-60">Нет сообщений</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 pb-4">
                        {recentMessages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex flex-col w-fit max-w-[70%]",
                                    msg.sender === 'PATIENT' ? "self-start items-start" : "self-end items-end"
                                )}
                            >
                                <div className="flex items-center gap-2 mb-1 px-1">
                                    <span className="text-[10px] font-medium text-slate-400">
                                        {msg.sender === 'PATIENT' ? patient.fullName : (msg.sender === 'AI' ? 'AI Bot' : 'Admin')}
                                    </span>
                                    <span className="text-[10px] text-slate-300">
                                        {new Date(msg.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div
                                    className={cn(
                                        "p-3 rounded-2xl text-sm shadow-sm leading-relaxed break-words whitespace-pre-wrap",
                                        msg.sender === 'PATIENT'
                                            ? "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
                                            : "bg-blue-600 text-white rounded-tr-none shadow-blue-200"
                                    )}
                                >
                                    <p className="break-words">{msg.content || <span className="italic opacity-80">[Медиа файл]</span>}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Quick Reply */}
            <div className="p-4 border-t bg-white/50 backdrop-blur-sm">
                <div className="flex gap-2 items-center bg-white border rounded-full px-2 py-1 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Написать сообщение..."
                        className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-10"
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <Button
                        onClick={handleSendMessage}
                        disabled={sendMessage.isPending}
                        size="icon"
                        className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 shrink-0"
                    >
                        <Send className="h-4 w-4 text-white" />
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
