import { useState } from 'react';
import { useCheckIns } from '@/hooks/useCheckIns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Camera, Mic } from 'lucide-react';
import { toast } from 'sonner';

interface CheckInFormProps {
    patientId: string;
    onSuccess?: () => void;
}

export function CheckInForm({ patientId, onSuccess }: CheckInFormProps) {
    const { createCheckIn } = useCheckIns(patientId);
    const [type, setType] = useState<string>('WEIGHT');
    const [valNum, setValNum] = useState('');
    const [valText, setValText] = useState('');

    // Simple state for media URL input (in real app, this would be a file uploader)
    const [mediaType, setMediaType] = useState<'photo' | 'audio' | null>(null);
    const [mediaUrl, setMediaUrl] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await createCheckIn.mutateAsync({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                type: type as any,
                valueNumber: valNum ? parseFloat(valNum) : undefined,
                valueText: valText || undefined,
                valueBool: type === 'DIET_ADHERENCE' ? true : undefined, // Simplification
                media: mediaType && mediaUrl ? { type: mediaType, url: mediaUrl } : undefined
            });

            toast.success('Чекин сохранен');
            setValNum('');
            setValText('');
            setMediaType(null);
            setMediaUrl('');
            onSuccess?.();
        } catch (err) {
            toast.error('Не удалось сохранить чекин');
        }
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Новый чекин
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Тип</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="WEIGHT">Вес</SelectItem>
                                <SelectItem value="MOOD">Настроение</SelectItem>
                                <SelectItem value="DIET_ADHERENCE">Диета</SelectItem>
                                <SelectItem value="STEPS">Шаги</SelectItem>
                                <SelectItem value="SLEEP">Сон</SelectItem>
                                <SelectItem value="FREE_TEXT">Заметка</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(type === 'WEIGHT' || type === 'STEPS' || type === 'SLEEP') && (
                        <div className="space-y-2">
                            <Label>Значение</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={valNum}
                                onChange={e => setValNum(e.target.value)}
                                placeholder={type === 'WEIGHT' ? 'кг' : 'кол-во'}
                            />
                        </div>
                    )}

                    {(type === 'MOOD' || type === 'FREE_TEXT') && (
                        <div className="space-y-2">
                            <Label>Заметка</Label>
                            <Textarea
                                value={valText}
                                onChange={e => setValText(e.target.value)}
                                placeholder="Как самочувствие?"
                            />
                        </div>
                    )}

                    {/* Media Inputs Mockup */}
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={mediaType === 'photo' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setMediaType(mediaType === 'photo' ? null : 'photo')}
                        >
                            <Camera className="w-4 h-4 mr-2" />
                            Фото
                        </Button>
                        <Button
                            type="button"
                            variant={mediaType === 'audio' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setMediaType(mediaType === 'audio' ? null : 'audio')}
                        >
                            <Mic className="w-4 h-4 mr-2" />
                            Аудио
                        </Button>
                    </div>

                    {mediaType && (
                        <Input
                            placeholder={`${mediaType === 'photo' ? 'Ссылка на фото' : 'Ссылка на аудио'}...`}
                            value={mediaUrl}
                            onChange={e => setMediaUrl(e.target.value)}
                        />
                    )}

                    <Button type="submit" disabled={createCheckIn.isPending} className="w-full">
                        {createCheckIn.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить чекин'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
