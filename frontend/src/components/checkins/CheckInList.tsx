import { format } from 'date-fns';
import { useCheckIns } from '@/hooks/useCheckIns';
import type { CheckIn } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Moon, Scale, Utensils, Smile, FileText, Image as ImageIcon, Mic } from 'lucide-react';

interface CheckInListProps {
    patientId: string;
}

const TypeIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'WEIGHT': return <Scale className="w-4 h-4 text-blue-500" />;
        case 'STEPS': return <Activity className="w-4 h-4 text-green-500" />;
        case 'SLEEP': return <Moon className="w-4 h-4 text-purple-500" />;
        case 'DIET_ADHERENCE': return <Utensils className="w-4 h-4 text-orange-500" />;
        case 'MOOD': return <Smile className="w-4 h-4 text-yellow-500" />;
        default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
};

export function CheckInList({ patientId }: CheckInListProps) {
    const { checkIns, isLoading } = useCheckIns(patientId);

    if (isLoading) return <div>Загрузка...</div>;

    return (
        <Card className="h-full max-h-[600px] flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium">История</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ScrollArea className="h-full pr-4">
                    <div className="space-y-4">
                        {checkIns?.map((item) => (
                            <div key={item.id} className="flex gap-3 items-start p-3 bg-muted/30 rounded-lg">
                                <div className="mt-1"><TypeIcon type={item.type} /></div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <span className="font-medium text-sm">{item.type}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(item.createdAt), 'd MMM, HH:mm')}
                                        </span>
                                    </div>

                                    <div className="text-sm">
                                        {item.valueNumber !== null && <span className="font-semibold">{item.valueNumber}</span>}
                                        {item.valueText && <p>{item.valueText}</p>}
                                        {item.valueBool !== null && (
                                            <Badge variant={item.valueBool ? 'default' : 'destructive'} className="text-[10px] h-5">
                                                {item.valueBool ? 'Да' : 'Нет'}
                                            </Badge>
                                        )}
                                    </div>

                                    {item.media && (
                                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground bg-muted p-1.5 rounded">
                                            {item.media.type === 'photo' ? <ImageIcon className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                                            <span className="truncate max-w-[200px]">{item.media.url}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
