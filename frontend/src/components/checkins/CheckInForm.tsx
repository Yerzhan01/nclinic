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
                type: type as any,
                valueNumber: valNum ? parseFloat(valNum) : undefined,
                valueText: valText || undefined,
                valueBool: type === 'DIET_ADHERENCE' ? true : undefined, // Simplification
                media: mediaType && mediaUrl ? { type: mediaType, url: mediaUrl } : undefined
            });

            toast.success('Check-in saved');
            setValNum('');
            setValText('');
            setMediaType(null);
            setMediaUrl('');
            onSuccess?.();
        } catch (err) {
            toast.error('Failed to save check-in');
        }
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    New Check-in
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="WEIGHT">Weight</SelectItem>
                                <SelectItem value="MOOD">Mood</SelectItem>
                                <SelectItem value="DIET_ADHERENCE">Diet</SelectItem>
                                <SelectItem value="STEPS">Steps</SelectItem>
                                <SelectItem value="SLEEP">Sleep</SelectItem>
                                <SelectItem value="FREE_TEXT">Note</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(type === 'WEIGHT' || type === 'STEPS' || type === 'SLEEP') && (
                        <div className="space-y-2">
                            <Label>Value</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={valNum}
                                onChange={e => setValNum(e.target.value)}
                                placeholder={type === 'WEIGHT' ? 'kg' : 'count'}
                            />
                        </div>
                    )}

                    {(type === 'MOOD' || type === 'FREE_TEXT') && (
                        <div className="space-y-2">
                            <Label>Note</Label>
                            <Textarea
                                value={valText}
                                onChange={e => setValText(e.target.value)}
                                placeholder="How are you feeling?"
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
                            Photo
                        </Button>
                        <Button
                            type="button"
                            variant={mediaType === 'audio' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setMediaType(mediaType === 'audio' ? null : 'audio')}
                        >
                            <Mic className="w-4 h-4 mr-2" />
                            Audio
                        </Button>
                    </div>

                    {mediaType && (
                        <Input
                            placeholder={`${mediaType === 'photo' ? 'Image' : 'Audio'} URL...`}
                            value={mediaUrl}
                            onChange={e => setMediaUrl(e.target.value)}
                        />
                    )}

                    <Button type="submit" disabled={createCheckIn.isPending} className="w-full">
                        {createCheckIn.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Check-in'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
