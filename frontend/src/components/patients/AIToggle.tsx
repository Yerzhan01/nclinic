'use client';

import { Loader2, Bot, BotOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePatientAIStatus, useTogglePatientAI } from '@/hooks/useAISettings';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AIToggleProps {
    patientId: string;
}

export function AIToggle({ patientId }: AIToggleProps) {
    const { data: status, isLoading } = usePatientAIStatus(patientId);
    const toggleAI = useTogglePatientAI();

    const handleToggle = async () => {
        try {
            await toggleAI.mutateAsync({
                patientId,
                enabled: !status?.aiEnabled
            });
            toast.success(status?.aiEnabled ? 'AI выключен' : 'AI включен');
        } catch {
            toast.error('Ошибка переключения AI');
        }
    };

    if (isLoading) {
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }

    const isAIEnabled = status?.aiEnabled ?? true;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        onClick={!toggleAI.isPending ? handleToggle : undefined}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-300 border select-none w-fit",
                            isAIEnabled
                                ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100",
                            toggleAI.isPending && "opacity-50 cursor-wait"
                        )}
                    >
                        {toggleAI.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <div className={cn(
                                "w-2.5 h-2.5 rounded-full shadow-sm",
                                isAIEnabled ? "bg-green-500 animate-pulse" : "bg-slate-300"
                            )} />
                        )}
                        <span className="text-xs font-semibold">
                            {isAIEnabled ? 'AI Активен' : 'AI Выключен'}
                        </span>
                        {isAIEnabled ? <Bot className="h-3.5 w-3.5 ml-1 opacity-50" /> : <BotOff className="h-3.5 w-3.5 ml-1 opacity-50" />}
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    {isAIEnabled
                        ? 'AI анализирует и отвечает на сообщения. Нажмите чтобы отключить.'
                        : `AI отключен${status?.aiPausedBy ? `. Кем: ${status.aiPausedBy}` : ''}. Нажмите чтобы включить.`
                    }
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
