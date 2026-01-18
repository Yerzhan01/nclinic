'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2, Save, Settings, Shield, Database, Sparkles, X } from 'lucide-react';

import { useAISettings, useUpdateAISettings, type AISettings } from '@/hooks/useAISettings';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

export default function AISettingsPage() {
    const { data: settings, isLoading } = useAISettings();
    const updateSettings = useUpdateAISettings();

    const [handoffTriggers, setHandoffTriggers] = useState<string[]>([]);
    const [forbiddenPhrases, setForbiddenPhrases] = useState<string[]>([]);
    const [pauseKeywords, setPauseKeywords] = useState<string[]>([]);
    const [resumeKeywords, setResumeKeywords] = useState<string[]>([]);
    const [statusKeywords, setStatusKeywords] = useState<string[]>([]);

    const { register, handleSubmit, setValue, watch } = useForm<AISettings>();
    const initializedRef = useRef(false);

    const temperature = watch('temperature') ?? 0.2;

    useEffect(() => {
        // Only initialize form once when settings are first loaded
        if (settings && !initializedRef.current) {
            initializedRef.current = true;
            setValue('model', settings.model);
            setValue('temperature', settings.temperature ?? 0.2);
            setValue('messageBufferSeconds', settings.messageBufferSeconds ?? 10);
            setValue('agent.systemPromptBase', settings.agent?.systemPromptBase);
            setValue('agent.styleGuide', settings.agent?.styleGuide);
            setValue('agent.replyStyle', settings.agent?.replyStyle ?? 'structured');
            setValue('agent.format', settings.agent?.format ?? 'bullets');
            setValue('agent.maxSentences', settings.agent?.maxSentences ?? 6);
            setValue('agent.maxOutputTokens', settings.agent?.maxOutputTokens);
            setValue('rag.enabled', settings.rag?.enabled ?? false);
            setValue('rag.topK', settings.rag?.topK ?? 5);
            setValue('rag.maxChars', settings.rag?.maxChars ?? 2000);

            setHandoffTriggers(settings.agent?.handoffTriggers ?? []);
            setForbiddenPhrases(settings.agent?.forbiddenPhrases ?? []);

            setValue('agent.commands.prefix', settings.agent?.commands?.prefix ?? '#ai');
            setPauseKeywords(settings.agent?.commands?.pauseKeywords ?? []);
            setResumeKeywords(settings.agent?.commands?.resumeKeywords ?? []);
            setStatusKeywords(settings.agent?.commands?.statusKeywords ?? []);
        }
    }, [settings, setValue]);

    const onSubmit = async (data: AISettings) => {
        try {
            await updateSettings.mutateAsync({
                ...data,
                agent: {
                    ...data.agent,
                    handoffTriggers,
                    forbiddenPhrases,
                    commands: {
                        prefix: data.agent?.commands?.prefix,
                        pauseKeywords,
                        resumeKeywords,
                        statusKeywords
                    }
                },
            });
            toast.success('Настройки AI сохранены');
        } catch {
            toast.error('Ошибка сохранения');
        }
    };

    const addTag = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
        if (value.trim()) {
            setter(prev => [...prev, value.trim()]);
        }
    };

    const removeTag = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
        setter(prev => prev.filter((_, i) => i !== index));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">AI Control Center</h1>
                    <p className="text-muted-foreground">Настройки AI-ассистента</p>
                </div>
                <a href="/settings/ai/quality">
                    <Button variant="outline" type="button">
                        📊 Quality Dashboard
                    </Button>
                </a>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                <Tabs defaultValue="model" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="model" className="gap-2">
                            <Sparkles className="h-4 w-4" />
                            Модель
                        </TabsTrigger>
                        <TabsTrigger value="behavior" className="gap-2">
                            <Settings className="h-4 w-4" />
                            Поведение
                        </TabsTrigger>
                        <TabsTrigger value="safety" className="gap-2">
                            <Shield className="h-4 w-4" />
                            Безопасность
                        </TabsTrigger>
                        <TabsTrigger value="commands" className="gap-2">
                            <Settings className="h-4 w-4" />
                            Команды
                        </TabsTrigger>
                        <TabsTrigger value="rag" className="gap-2">
                            <Database className="h-4 w-4" />
                            RAG
                        </TabsTrigger>
                    </TabsList>

                    {/* Model Tab */}
                    <TabsContent value="model">
                        <Card>
                            <CardHeader>
                                <CardTitle>Параметры модели</CardTitle>
                                <CardDescription>Модель OpenAI и параметры генерации</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Модель</Label>
                                        <Select
                                            value={watch('model') || 'gpt-4o-mini'}
                                            onValueChange={v => setValue('model', v)}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                                                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                                                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Макс. токенов вывода</Label>
                                        <Input
                                            type="number"
                                            {...register('agent.maxOutputTokens', { valueAsNumber: true })}
                                            placeholder="1024"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Температура: {temperature}</Label>
                                    </div>
                                    <Slider
                                        value={[temperature]}
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        onValueChange={([v]) => setValue('temperature', v)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        0 = детерминированные ответы, 1 = креативные
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Behavior Tab */}
                    <TabsContent value="behavior">
                        <Card>
                            <CardHeader>
                                <CardTitle>Поведение AI</CardTitle>
                                <CardDescription>Промпты и стиль ответов</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Базовый системный промпт</Label>
                                    <Textarea
                                        {...register('agent.systemPromptBase')}
                                        rows={6}
                                        placeholder="Инструкции для AI..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Стиль общения (Style Guide)</Label>
                                    <Textarea
                                        {...register('agent.styleGuide')}
                                        rows={4}
                                        placeholder="Как AI должен формировать ответы..."
                                    />
                                </div>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Стиль</Label>
                                        <Select
                                            value={watch('agent.replyStyle') || 'structured'}
                                            onValueChange={v => setValue('agent.replyStyle', v as 'concise' | 'structured' | 'detailed')}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="concise">Краткий</SelectItem>
                                                <SelectItem value="structured">Структурный</SelectItem>
                                                <SelectItem value="detailed">Детальный</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Формат</Label>
                                        <Select
                                            value={watch('agent.format') || 'bullets'}
                                            onValueChange={v => setValue('agent.format', v as 'bullets' | 'paragraphs')}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="bullets">Пункты</SelectItem>
                                                <SelectItem value="paragraphs">Абзацы</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Макс. предложений</Label>
                                        <Input
                                            type="number"
                                            {...register('agent.maxSentences', { valueAsNumber: true })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                        <Label>Буферизация сообщений (сек)</Label>
                                        <span className="text-sm text-muted-foreground">{watch('messageBufferSeconds') ?? 10} сек</span>
                                    </div>
                                    <Slider
                                        value={[watch('messageBufferSeconds') ?? 10]}
                                        min={0}
                                        max={60}
                                        step={1}
                                        onValueChange={([v]) => setValue('messageBufferSeconds', v)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Задержка перед ответом, чтобы объединить несколько сообщений от пациента в одно.
                                        0 = отвечать мгновенно.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Safety Tab */}
                    <TabsContent value="safety">
                        <Card>
                            <CardHeader>
                                <CardTitle>Безопасность</CardTitle>
                                <CardDescription>Стоп-слова и запрещенные фразы</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Handoff Triggers (мгновенный handoff ДО AI)</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Если сообщение пациента содержит эти слова — AI не вызывается, сразу handoff
                                    </p>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {handoffTriggers.map((t, i) => (
                                            <Badge key={i} variant="destructive" className="gap-1">
                                                {t}
                                                <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(setHandoffTriggers, i)} />
                                            </Badge>
                                        ))}
                                    </div>
                                    <Input
                                        placeholder="Добавить триггер (Enter)"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addTag(setHandoffTriggers, e.currentTarget.value);
                                                e.currentTarget.value = '';
                                            }
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Forbidden Phrases (фильтр ПОСЛЕ AI)</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Если AI генерирует эти фразы — ответ блокируется, handoff
                                    </p>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {forbiddenPhrases.map((p, i) => (
                                            <Badge key={i} variant="outline" className="gap-1">
                                                {p}
                                                <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(setForbiddenPhrases, i)} />
                                            </Badge>
                                        ))}
                                    </div>
                                    <Input
                                        placeholder="Добавить фразу (Enter)"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addTag(setForbiddenPhrases, e.currentTarget.value);
                                                e.currentTarget.value = '';
                                            }
                                        }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Commands Tab */}
                    <TabsContent value="commands">
                        <Card>
                            <CardHeader>
                                <CardTitle>Команды оператора</CardTitle>
                                <CardDescription>Управление AI через чат (например: #ai pause)</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Префикс команд</Label>
                                    <Input
                                        {...register('agent.commands.prefix')}
                                        placeholder="#ai"
                                    />
                                </div>

                                <div className="grid gap-6 md:grid-cols-3">
                                    {/* Pause Keywords */}
                                    <div className="space-y-2">
                                        <Label>Ключевые слова: ПАУЗА</Label>
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {pauseKeywords.map((k, i) => (
                                                <Badge key={i} variant="secondary" className="gap-1">
                                                    {k}
                                                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(setPauseKeywords, i)} />
                                                </Badge>
                                            ))}
                                        </div>
                                        <Input
                                            placeholder="Добавить слово..."
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addTag(setPauseKeywords, e.currentTarget.value);
                                                    e.currentTarget.value = '';
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Resume Keywords */}
                                    <div className="space-y-2">
                                        <Label>Ключевые слова: СТАРТ</Label>
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {resumeKeywords.map((k, i) => (
                                                <Badge key={i} variant="secondary" className="gap-1">
                                                    {k}
                                                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(setResumeKeywords, i)} />
                                                </Badge>
                                            ))}
                                        </div>
                                        <Input
                                            placeholder="Добавить слово..."
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addTag(setResumeKeywords, e.currentTarget.value);
                                                    e.currentTarget.value = '';
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Status Keywords */}
                                    <div className="space-y-2">
                                        <Label>Ключевые слова: СТАТУС</Label>
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {statusKeywords.map((k, i) => (
                                                <Badge key={i} variant="secondary" className="gap-1">
                                                    {k}
                                                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(setStatusKeywords, i)} />
                                                </Badge>
                                            ))}
                                        </div>
                                        <Input
                                            placeholder="Добавить слово..."
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addTag(setStatusKeywords, e.currentTarget.value);
                                                    e.currentTarget.value = '';
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* RAG Tab */}
                    <TabsContent value="rag">
                        <Card>
                            <CardHeader>
                                <CardTitle>База знаний (RAG)</CardTitle>
                                <CardDescription>Настройки retrieval-augmented generation</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Включить RAG</Label>
                                        <p className="text-xs text-muted-foreground">
                                            AI будет использовать базу знаний для ответов
                                        </p>
                                    </div>
                                    <Switch
                                        checked={watch('rag.enabled') ?? false}
                                        onCheckedChange={v => setValue('rag.enabled', v)}
                                    />
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Top K (документов)</Label>
                                        <Input
                                            type="number"
                                            {...register('rag.topK', { valueAsNumber: true })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Max Chars (контекст)</Label>
                                        <Input
                                            type="number"
                                            {...register('rag.maxChars', { valueAsNumber: true })}
                                        />
                                    </div>
                                </div>
                                <div className="border rounded-lg p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Управление источниками и документами доступно в разделе RAG Admin
                                    </p>
                                    <Button variant="outline" size="sm" className="mt-2" type="button" asChild>
                                        <a href="/settings/rag">Открыть RAG Admin</a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <div className="mt-6">
                    <Button type="submit" disabled={updateSettings.isPending} className="w-full">
                        {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Сохранить настройки AI
                    </Button>
                </div>
            </form>
        </div>
    );
}
