'use client';

import { usePatientTimeline } from '@/hooks/usePatients';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MessageSquare, CheckCircle, AlertTriangle } from 'lucide-react';

interface TimelineEvent {
    id: string;
    type: 'message' | 'check_in' | 'alert';
    date: string;
    // Message specific
    sender?: string;
    content?: string;
    // CheckIn specific
    // valueText?: string;
    // Alert specific
    level?: string;
    title?: string;
    [key: string]: any;
}

export function PatientTimeline({ patientId }: { patientId: string }) {
    const { data: rawTimeline, isLoading } = usePatientTimeline(patientId);

    // Filter out messages - only show check-ins and alerts (messages are in Chat tab)
    const timeline = rawTimeline?.filter((event: TimelineEvent) =>
        event.type === 'check_in' || event.type === 'alert'
    );

    if (isLoading) return <div className="p-4 text-center text-muted-foreground">Загрузка хронологии...</div>;
    if (!timeline || timeline.length === 0) return <div className="p-4 text-center text-muted-foreground">Нет событий. Чек-ины и алерты появятся здесь.</div>;

    return (
        <div className="relative pl-6 border-l ml-4 my-4 space-y-6">
            {(timeline as TimelineEvent[]).map((event, index) => (
                <div key={event.id || index} className="relative">
                    <div className={`absolute -left-[33px] top-1 rounded-full p-1.5 text-white shadow-sm ${event.type === 'message' ? (event.sender === 'PATIENT' ? 'bg-green-500' : 'bg-blue-500') :
                        event.type === 'check_in' ? 'bg-purple-500' : 'bg-red-500'
                        }`}>
                        {event.type === 'message' && <MessageSquare size={14} />}
                        {event.type === 'check_in' && <CheckCircle size={14} />}
                        {event.type === 'alert' && <AlertTriangle size={14} />}
                    </div>

                    <Card className="mb-2 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${event.type === 'message' ? 'bg-blue-100 text-blue-800' :
                                    event.type === 'check_in' ? 'bg-purple-100 text-purple-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                    {event.type === 'message' ? 'СООБЩЕНИЕ' :
                                        event.type === 'check_in' ? 'ЧЕКИН' : 'АЛЕРТ'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {format(new Date(event.date), 'dd MMM HH:mm', { locale: ru })}
                                </span>
                            </div>

                            <div className="text-sm">
                                {event.type === 'message' && (
                                    <div className="whitespace-pre-wrap">
                                        <span className="font-medium mr-2">
                                            {event.sender === 'PATIENT' ? 'Пациент' : (event.sender === 'AI' ? 'AI' : 'Оператор')}:
                                        </span>
                                        {event.content || <span className="italic text-muted-foreground">[Медиа файл]</span>}
                                    </div>
                                )}

                                {event.type === 'check_in' && (
                                    <div>
                                        <div className="font-medium">{event.type}</div> {/* Note: backend field name conflict? checkIn has field 'type' too */}
                                        <div className="text-muted-foreground mt-1">
                                            {event.valueText || event.valueNumber || (event.valueBool ? 'Да' : 'Нет')}
                                        </div>
                                    </div>
                                )}

                                {event.type === 'alert' && (
                                    <div>
                                        <div className="font-medium text-red-600">{event.type} ({event.level})</div> {/* Alert type field conflict? */}
                                        <div className="mt-1">{event.title || event.description}</div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </div>
    );
}
