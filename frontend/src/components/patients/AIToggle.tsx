'use client';

import { Loader2, Bot, BotOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePatientAIStatus, useTogglePatientAI } from '@/hooks/useAISettings';
import { toast } from 'sonner';

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
                    <Button
                        variant={isAIEnabled ? 'default' : 'outline'}
                        size="sm"
                        onClick={handleToggle}
                        disabled={toggleAI.isPending}
                        className="gap-2"
                    >
                        {toggleAI.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isAIEnabled ? (
                            <Bot className="h-4 w-4" />
                        ) : (
                            <BotOff className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">
                            {isAIEnabled ? 'AI ВКЛ' : 'AI ВЫКЛ'}
                        </span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    {isAIEnabled
                        ? 'AI анализирует сообщения пациента. Нажмите чтобы выключить.'
                        : `AI выключен${status?.aiPausedBy ? ` (${status.aiPausedBy})` : ''}. Нажмите чтобы включить.`
                    }
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
