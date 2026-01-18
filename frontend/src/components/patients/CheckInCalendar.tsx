'use client';

import { useState } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday,
    startOfWeek,
    endOfWeek
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Apple, Scale, Activity, FileText, CheckCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCheckIns } from '@/hooks/useCheckIns';
import type { CheckIn } from '@/types/api';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface CheckInCalendarProps {
    patientId: string;
    programStartDate?: string;
}

export function CheckInCalendar({ patientId, programStartDate }: CheckInCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = eachDayOfInterval({
        start: calendarStart,
        end: calendarEnd
    });

    // Fetch check-ins for the visible range
    const { checkIns, isLoading } = useCheckIns(patientId, {
        from: calendarStart,
        to: calendarEnd
    });

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const getDayCheckIns = (day: Date) => {
        if (!checkIns) return [];
        return checkIns.filter(c => isSameDay(new Date(c.createdAt), day));
    };

    const getTypeIcon = (type: CheckIn['type']) => {
        switch (type) {
            case 'DIET_ADHERENCE':
                return (
                    <div className="flex items-center justify-center w-7 h-7 bg-green-100 rounded-full">
                        <Apple className="w-4 h-4 text-green-600" />
                    </div>
                );
            case 'WEIGHT':
                return (
                    <div className="flex items-center justify-center w-7 h-7 bg-blue-100 rounded-full">
                        <Scale className="w-4 h-4 text-blue-600" />
                    </div>
                );
            case 'ACTIVITY':
            case 'STEPS':
                return (
                    <div className="flex items-center justify-center w-7 h-7 bg-orange-100 rounded-full">
                        <Activity className="w-4 h-4 text-orange-600" />
                    </div>
                );
            default:
                return (
                    <div className="flex items-center justify-center w-7 h-7 bg-gray-100 rounded-full">
                        <CheckCircle className="w-4 h-4 text-gray-500" />
                    </div>
                );
        }
    };

    return (
        <Card className="h-full border-none shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-2 py-4">
                <CardTitle className="text-lg font-bold capitalize">
                    {format(currentMonth, 'LLLL yyyy', { locale: ru })}
                </CardTitle>
                <div className="flex items-center space-x-1">
                    <Button variant="outline" size="icon" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-2">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 mb-2 text-center text-xs text-muted-foreground font-medium">
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                        <div key={d} className="py-1">{d}</div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, idx) => {
                        const dayCheckIns = getDayCheckIns(day);
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const isDayToday = isToday(day);
                        // Unique types for icons (show max 3 distinct icons)
                        const uniqueTypes = Array.from(new Set(dayCheckIns.map(c => c.type))).slice(0, 4);

                        return (
                            <Popover key={day.toISOString()}>
                                <PopoverTrigger asChild>
                                    <div
                                        className={cn(
                                            "min-h-[80px] p-1 border rounded-md text-xs relative hover:bg-muted/50 transition-colors cursor-pointer flex flex-col",
                                            !isCurrentMonth && "text-muted-foreground bg-muted/20 border-transparent",
                                            isDayToday && "bg-accent/20 border-primary/50"
                                        )}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className={cn("font-medium", isDayToday && "text-primary")}>
                                                {format(day, 'd')}
                                            </span>
                                            {dayCheckIns.length > 0 && (
                                                <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded-full">
                                                    {dayCheckIns.length}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-auto flex flex-wrap gap-1 content-end">
                                            {uniqueTypes.map(type => (
                                                <div key={type} title={type}>
                                                    {getTypeIcon(type as any)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-0" align="start">
                                    <div className="bg-primary/10 p-3 border-b">
                                        <h4 className="font-semibold text-sm">
                                            {format(day, 'd MMMM yyyy', { locale: ru })}
                                        </h4>
                                    </div>
                                    <div className="p-3 space-y-3 max-h-[300px] overflow-y-auto">
                                        {dayCheckIns.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">Нет отметок за этот день</p>
                                        ) : (
                                            dayCheckIns.map(checkIn => (
                                                <div key={checkIn.id} className="flex gap-3 text-sm group">
                                                    <div className="mt-0.5">
                                                        {getTypeIcon(checkIn.type)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between">
                                                            <span className="font-medium text-xs text-muted-foreground">{checkIn.type}</span>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {format(new Date(checkIn.createdAt), 'HH:mm')}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1">
                                                            {checkIn.media ? (
                                                                <div className="rounded-md overflow-hidden border mt-1">
                                                                    {checkIn.media.type === 'photo' ? (
                                                                        <div className="relative aspect-video bg-black/5">
                                                                            <Image
                                                                                src={checkIn.media.url}
                                                                                alt="CheckIn"
                                                                                fill
                                                                                className="object-contain"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-2 bg-muted text-xs">Аудиозапись</div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <p className="text-foreground/90">
                                                                    {checkIn.valueText || (checkIn.valueBool ? 'Да' : checkIn.valueBool === false ? 'Нет' : checkIn.valueNumber)}
                                                                </p>
                                                            )}
                                                            <div className="mt-1 text-[10px] text-muted-foreground flex gap-2">
                                                                <span>Источник: {checkIn.source}</span>
                                                                {checkIn.status !== 'RECEIVED' && (
                                                                    <span className="text-yellow-600 font-medium">{checkIn.status}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
