'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api';
import {
    useWhatsAppStatus,
    useConnectWhatsApp,
    useReconnectWhatsApp,
    useAIStatus,
    useConnectAI,
    useTestAI,
    useAmoCRMStatus,
    useConnectAmoCRM,
    useTestAmoCRM,
    useDisconnectAmoCRM,
    useAmoPipelines
} from '@/hooks/useIntegrations';
import type { AmoPipeline } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Bot, CheckCircle, XCircle, RefreshCw, Settings, Copy } from 'lucide-react';

// Schemas
const whatsappSchema = z.object({
    apiUrl: z.string().min(1, 'API URL обязателен'),
    idInstance: z.string().min(1, 'ID Instance обязательно'),
    apiTokenInstance: z.string().min(1, 'API Token обязателен'),
});

const aiSchema = z.object({
    apiKey: z.string().min(1, 'API Key обязателен'),
    model: z.string().min(1, 'Модель обязательна'),
});

const amoCRMSchema = z.object({
    baseDomain: z.string().min(1, 'Домен обязателен (например, example.amocrm.ru)'),
    accessToken: z.string().min(1, 'Access Token обязателен'),
    pipelineId: z.number().optional(),
    statusId: z.number().optional(),
    mappings: z.record(z.string(), z.object({
        pipelineId: z.number(),
        statusId: z.number(),
    })).optional(),
});

type WhatsAppForm = z.infer<typeof whatsappSchema>;
type AIForm = z.infer<typeof aiSchema>;
type AmoCRMForm = z.infer<typeof amoCRMSchema>;

function StatusBadge({ connected, status }: { connected: boolean; status?: string }) {
    let variant: 'default' | 'destructive' | 'outline' | 'secondary' = connected ? 'default' : 'destructive';
    let label = connected ? 'Подключено' : 'Отключено';
    let Icon = connected ? CheckCircle : XCircle;

    if (status === 'WEBHOOK_MISSING') {
        variant = 'secondary';
        label = 'Webhook?';
        Icon = RefreshCw;
    } else if (status === 'AUTH_FAILED') {
        variant = 'destructive';
        label = 'Авторизация?';
    } else if (status === 'NOT_CONFIGURED') {
        variant = 'outline';
        label = 'Не настроено';
    }

    return (
        <Badge variant={variant} className="gap-1">
            <Icon className="h-3 w-3" />
            {label}
        </Badge>
    );
}

function CopyButton({ text }: { text: string }) {
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        toast.success('Скопировано');
    };
    return (
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
            <Copy className="h-3 w-3" />
        </Button>
    );
}

export default function IntegrationsPage() {
    const [waDialogOpen, setWaDialogOpen] = useState(false);
    const [aiDialogOpen, setAiDialogOpen] = useState(false);
    const [testText, setTestText] = useState('');
    const [testResult, setTestResult] = useState<{ sentiment?: string; summary?: string; suggestedReply?: string } | null>(null);

    // WhatsApp
    const { data: waStatus, isLoading: waLoading, refetch: refetchWaStatus } = useWhatsAppStatus();
    const connectWa = useConnectWhatsApp();
    const reconnectWa = useReconnectWhatsApp();

    // AI
    const { data: aiStatus, isLoading: aiLoading } = useAIStatus();
    const connectAi = useConnectAI();
    const testAi = useTestAI();

    // AmoCRM
    const [amoDialogOpen, setAmoDialogOpen] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState('');
    const { data: amoStatus, isLoading: amoLoading } = useAmoCRMStatus();
    // Only fetch pipelines if connected AND dialog is open
    const { data: pipelines, isLoading: pipelinesLoading, refetch: fetchPipelines } = useAmoPipelines(
        !!amoStatus?.isConnected && amoDialogOpen
    );
    const connectAmo = useConnectAmoCRM();
    const testAmo = useTestAmoCRM();
    const disconnectAmo = useDisconnectAmoCRM();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // eslint-disable-next-line
            setWebhookUrl(`${window.location.origin}/api/integrations/amocrm/webhook`);
        }
    }, []);

    const amoForm = useForm<AmoCRMForm>({
        resolver: zodResolver(amoCRMSchema),
        defaultValues: { baseDomain: '', accessToken: '', pipelineId: undefined, statusId: undefined },
    });

    // Update form default values when status loads or dialog opens
    useEffect(() => {
        if (amoDialogOpen && amoStatus) {
            if (amoStatus.baseDomain) amoForm.setValue('baseDomain', amoStatus.baseDomain);
            if (amoStatus.pipelineId) amoForm.setValue('pipelineId', amoStatus.pipelineId);
            if (amoStatus.statusId) amoForm.setValue('statusId', amoStatus.statusId);
            if (amoStatus.mappings) {
                // Cast to any because RHF types might be strict, but structure matches
                amoForm.setValue('mappings', amoStatus.mappings as any);
            }
        }
    }, [amoDialogOpen, amoStatus, amoForm]);


    const waForm = useForm<WhatsAppForm>({
        resolver: zodResolver(whatsappSchema),
        defaultValues: { idInstance: '', apiTokenInstance: '', apiUrl: 'https://api.green-api.com' },
    });

    const aiForm = useForm<AIForm>({
        resolver: zodResolver(aiSchema),
        defaultValues: { apiKey: '', model: 'gpt-4o-mini' },
    });

    const handleConnectWa = async (data: WhatsAppForm) => {
        try {
            await connectWa.mutateAsync(data);
            toast.success('WhatsApp подключен');
            setWaDialogOpen(false);
            waForm.reset();
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleReconnectWa = async () => {
        try {
            await reconnectWa.mutateAsync();
            toast.success('Переподключение запущено');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleConnectAi = async (data: AIForm) => {
        try {
            await connectAi.mutateAsync(data);
            toast.success('AI подключен');
            setAiDialogOpen(false);
            aiForm.reset();
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleTestAi = async () => {
        if (!testText.trim()) return;
        setTestResult(null);
        try {
            const result = await testAi.mutateAsync(testText) as { sentiment?: string; summary?: string; suggestedReply?: string };
            setTestResult(result);
            toast.success('Тест успешен');
        } catch (error) {
            toast.error(getErrorMessage(error));
            setTestResult(null);
        }
    };

    const handleConnectAmo = async (data: AmoCRMForm) => {
        try {
            await connectAmo.mutateAsync(data);
            toast.success('amoCRM подключен');
            setAmoDialogOpen(false);
            // Don't reset form immediately so user can see what they typed or select pipeline
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleTestAmo = async () => {
        try {
            const result = await testAmo.mutateAsync();
            if (result && result.success) {
                toast.success('Соединение с amoCRM успешно');
            } else {
                toast.error('Ошибка соединения с amoCRM');
            }
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleDisconnectAmo = async () => {
        try {
            await disconnectAmo.mutateAsync();
            toast.success('amoCRM отключен');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const waConnected = waStatus?.status === 'CONNECTED';
    const aiConnected = aiStatus?.status === 'connected';
    const amoConnected = amoStatus?.isConnected;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Интеграции</h1>
                <p className="text-muted-foreground">Настройка внешних сервисов</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* WhatsApp Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-green-500" />
                                WhatsApp (Green API)
                            </CardTitle>
                            {waLoading ? (
                                <Skeleton className="h-5 w-20" />
                            ) : (
                                <StatusBadge connected={waConnected} status={waStatus?.status} />
                            )}
                        </div>
                        <CardDescription>
                            Интеграция с WhatsApp через Green API
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {waLoading ? (
                            <Skeleton className="h-20 w-full" />
                        ) : (
                            <>
                                {waStatus?.status && (
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm">
                                            Статус: <span className="font-medium">{waStatus.status}</span>
                                        </p>
                                        {waStatus.details && (
                                            <p className="text-xs text-muted-foreground">{waStatus.details}</p>
                                        )}
                                    </div>
                                )}

                                {waStatus?.qrCode && waStatus?.status === 'AUTH_FAILED' && (
                                    <div className="p-4 bg-white rounded-lg border">
                                        <p className="text-sm text-muted-foreground mb-2">Отсканируйте QR-код для авторизации:</p>
                                        <img
                                            src={`data:image/png;base64,${waStatus.qrCode}`}
                                            alt="WhatsApp QR Code"
                                            className="w-48 h-48 mx-auto"
                                        />
                                    </div>
                                )}

                                {(waConnected || waStatus?.status === 'WEBHOOK_MISSING') && (
                                    <div className="p-3 bg-muted rounded-md space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-medium text-muted-foreground uppercase">Webhook URL</p>
                                            {waStatus?.status === 'WEBHOOK_MISSING' && (
                                                <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-[10px]">
                                                    Не совпадает
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 bg-background p-2 rounded border">
                                            <code className="text-xs flex-1 truncate">
                                                {typeof window !== 'undefined' ? `${window.location.origin}/api/v1/integrations/whatsapp/webhook` : '...'}
                                            </code>
                                            <CopyButton
                                                text={typeof window !== 'undefined' ? `${window.location.origin}/api/v1/integrations/whatsapp/webhook` : ''}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Скопируйте URL и укажите в настройках инстанса Green API.
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Dialog open={waDialogOpen} onOpenChange={setWaDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Settings className="h-4 w-4 mr-2" />
                                                Настроить
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Подключить WhatsApp</DialogTitle>
                                            </DialogHeader>
                                            <form onSubmit={waForm.handleSubmit(handleConnectWa)} className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">API URL</label>
                                                    <Input {...waForm.register('apiUrl')} placeholder="https://api.green-api.com" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">ID Instance</label>
                                                    <Input {...waForm.register('idInstance')} placeholder="1101..." />
                                                    {waForm.formState.errors.idInstance && (
                                                        <p className="text-sm text-destructive">
                                                            {waForm.formState.errors.idInstance.message}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">API Token Instance</label>
                                                    <Input
                                                        {...waForm.register('apiTokenInstance')}
                                                        placeholder="Your API Token"
                                                        type="password"
                                                    />
                                                    {waForm.formState.errors.apiTokenInstance && (
                                                        <p className="text-sm text-destructive">
                                                            {waForm.formState.errors.apiTokenInstance.message}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button type="submit" className="w-full" disabled={connectWa.isPending}>
                                                    {connectWa.isPending ? 'Сохранение...' : 'Сохранить'}
                                                </Button>
                                            </form>
                                        </DialogContent>
                                    </Dialog>

                                    {waStatus?.isEnabled && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => refetchWaStatus()} // Manual check
                                                title="Проверить соединение"
                                            >
                                                <RefreshCw className="h-4 w-4 mr-2" />
                                                Проверить
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleReconnectWa}
                                                disabled={reconnectWa.isPending}
                                                title="Получить новый QR"
                                            >
                                                QR код
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* AI Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Bot className="h-5 w-5 text-blue-500" />
                                AI (OpenAI)
                            </CardTitle>
                            {aiLoading ? (
                                <Skeleton className="h-5 w-20" />
                            ) : (
                                <StatusBadge connected={aiConnected} />
                            )}
                        </div>
                        <CardDescription>
                            Интеграция с OpenAI для анализа сообщений
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {aiLoading ? (
                            <Skeleton className="h-20 w-full" />
                        ) : (
                            <>
                                {aiStatus?.model && (
                                    <p className="text-sm">
                                        Модель: <span className="font-medium">{aiStatus.model}</span>
                                    </p>
                                )}

                                {aiStatus?.error && (
                                    <p className="text-sm text-destructive">{aiStatus.error}</p>
                                )}

                                <div className="flex gap-2">
                                    <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Settings className="h-4 w-4 mr-2" />
                                                Настроить
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Подключить AI</DialogTitle>
                                            </DialogHeader>
                                            <form onSubmit={aiForm.handleSubmit(handleConnectAi)} className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">API Key</label>
                                                    <Input
                                                        {...aiForm.register('apiKey')}
                                                        placeholder="sk-..."
                                                        type="password"
                                                    />
                                                    {aiForm.formState.errors.apiKey && (
                                                        <p className="text-sm text-destructive">
                                                            {aiForm.formState.errors.apiKey.message}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Модель</label>
                                                    <Input {...aiForm.register('model')} placeholder="gpt-4o-mini" />
                                                    {aiForm.formState.errors.model && (
                                                        <p className="text-sm text-destructive">
                                                            {aiForm.formState.errors.model.message}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button type="submit" className="w-full" disabled={connectAi.isPending}>
                                                    {connectAi.isPending ? 'Подключение...' : 'Подключить'}
                                                </Button>
                                            </form>
                                        </DialogContent>
                                    </Dialog>
                                </div>

                                {aiConnected && (
                                    <div className="space-y-3 pt-4 border-t">
                                        <label className="text-sm font-medium">Тест AI</label>
                                        <Textarea
                                            placeholder="Введите текст для тестирования..."
                                            value={testText}
                                            onChange={(e) => setTestText(e.target.value)}
                                            rows={2}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleTestAi}
                                            disabled={testAi.isPending || !testText.trim()}
                                        >
                                            {testAi.isPending ? 'Тестирование...' : 'Тестировать'}
                                        </Button>

                                        {testResult && (
                                            <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">Тональность:</span>
                                                    <Badge variant={testResult.sentiment === 'positive' ? 'default' : testResult.sentiment === 'negative' ? 'destructive' : 'secondary'}>
                                                        {testResult.sentiment || 'N/A'}
                                                    </Badge>
                                                </div>
                                                {testResult.summary && (
                                                    <div>
                                                        <span className="text-muted-foreground">Суть:</span>
                                                        <p className="mt-1">{testResult.summary}</p>
                                                    </div>
                                                )}
                                                {testResult.suggestedReply && (
                                                    <div>
                                                        <span className="text-muted-foreground">Ответ AI:</span>
                                                        <p className="mt-1 p-2 bg-background rounded border">{testResult.suggestedReply}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* AmoCRM Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <span className="text-blue-600 font-bold">amo</span>
                                <span>CRM</span>
                            </CardTitle>
                            {amoLoading ? (
                                <Skeleton className="h-5 w-20" />
                            ) : (
                                <StatusBadge connected={!!amoConnected} />
                            )}
                        </div>
                        <CardDescription>
                            Синхронизация сделок и контактов
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {amoLoading ? (
                            <Skeleton className="h-20 w-full" />
                        ) : (
                            <>
                                {amoStatus?.baseDomain && (
                                    <p className="text-sm">
                                        Домен: <span className="font-medium">{amoStatus.baseDomain}</span>
                                    </p>
                                )}

                                {amoConnected && (
                                    <div className="p-3 bg-muted rounded-md space-y-2">
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Webhook URL</p>
                                        <div className="flex items-center gap-2 bg-background p-2 rounded border">
                                            <code className="text-xs flex-1 truncate">{webhookUrl}</code>
                                            <CopyButton text={webhookUrl} />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Укажите этот URL в настройках интеграции amoCRM для получения обновлений статусов.
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Dialog open={amoDialogOpen} onOpenChange={setAmoDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Settings className="h-4 w-4 mr-2" />
                                                Настроить
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                            <DialogHeader>
                                                <DialogTitle>Подключить amoCRM</DialogTitle>
                                            </DialogHeader>
                                            <form onSubmit={amoForm.handleSubmit(handleConnectAmo)} className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Base Domain</label>
                                                    <Input {...amoForm.register('baseDomain')} placeholder="example.amocrm.ru" />
                                                    {amoForm.formState.errors.baseDomain && (
                                                        <p className="text-sm text-destructive">
                                                            {amoForm.formState.errors.baseDomain.message}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Long-Lived Access Token</label>
                                                    <Input
                                                        {...amoForm.register('accessToken')}
                                                        placeholder="eyJ..."
                                                        type="password"
                                                    />
                                                    {amoForm.formState.errors.accessToken && (
                                                        <p className="text-sm text-destructive">
                                                            {amoForm.formState.errors.accessToken.message}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Pipeline (Воронка)</label>
                                                    {pipelinesLoading ? (
                                                        <Skeleton className="h-10 w-full" />
                                                    ) : pipelines && pipelines.length > 0 ? (
                                                        <Select
                                                            value={amoForm.watch('pipelineId')?.toString()}
                                                            onValueChange={(value) => amoForm.setValue('pipelineId', parseInt(value))}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Выберите воронку" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {pipelines.map((p: AmoPipeline) => (
                                                                    <SelectItem key={p.id} value={p.id.toString()}>
                                                                        {p.name} {p.is_main && '(Main)'}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    {...amoForm.register('pipelineId', { valueAsNumber: true })}
                                                                    type="number"
                                                                    placeholder="Pipeline ID"
                                                                />
                                                                {amoConnected && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="icon"
                                                                        onClick={() => fetchPipelines()}
                                                                        disabled={pipelinesLoading}
                                                                        title="Load Pipelines"
                                                                    >
                                                                        <RefreshCw className={`h-4 w-4 ${pipelinesLoading ? 'animate-spin' : ''}`} />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                {amoConnected ? 'Не удалось загрузить воронки. Введите ID вручную.' : 'Подключитесь, чтобы выбрать воронку из списка.'}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {amoForm.formState.errors.pipelineId && (
                                                        <p className="text-sm text-destructive">
                                                            {amoForm.formState.errors.pipelineId.message}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Статус (Этап)</label>
                                                    <Select
                                                        value={amoForm.watch('statusId')?.toString()}
                                                        onValueChange={(value) => amoForm.setValue('statusId', parseInt(value))}
                                                        disabled={!amoForm.watch('pipelineId')}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Выберите статус" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {pipelines?.find(p => p.id === amoForm.watch('pipelineId'))
                                                                ?._embedded.statuses.map(s => (
                                                                    <SelectItem key={s.id} value={s.id.toString()}>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                                                            {s.name}
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>


                                                <details className="pt-4 border-t">
                                                    <summary className="text-sm font-medium cursor-pointer hover:text-primary">
                                                        Маппинг статусов (Автоматизация) ▾
                                                    </summary>
                                                    <div className="mt-3 space-y-3">
                                                        <p className="text-xs text-muted-foreground">
                                                            Автоматически меняйте статус сделки при достижении этапов программы
                                                        </p>
                                                        <div className="grid gap-3">
                                                            {[
                                                                { key: 'PROGRAM_STARTED', label: '🚀 Старт программы' },
                                                                { key: 'RISK_HIGH', label: '⚠️ Высокий риск' },
                                                                { key: 'WEEK_1', label: '📅 1-я неделя' },
                                                                { key: 'WEEK_2', label: '📅 2-я неделя' },
                                                                { key: 'WEEK_3', label: '📅 3-я неделя' },
                                                                { key: 'WEEK_4', label: '📅 4-я неделя' },
                                                                { key: 'WEEK_5', label: '📅 5-я неделя' },
                                                                { key: 'WEEK_6', label: '📅 6-я неделя' },
                                                            ].map(({ key, label }) => (
                                                                <div key={key} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                                                    <span className="text-xs font-medium w-32 shrink-0">{label}</span>
                                                                    <Select
                                                                        value={amoForm.watch(`mappings.${key}.pipelineId`)?.toString()}
                                                                        onValueChange={(val) => {
                                                                            amoForm.setValue(`mappings.${key}.pipelineId`, parseInt(val));
                                                                            amoForm.setValue(`mappings.${key}.statusId`, 0);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-8 text-xs flex-1">
                                                                            <SelectValue placeholder="Воронка" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {pipelines?.map(p => (
                                                                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <Select
                                                                        value={amoForm.watch(`mappings.${key}.statusId`)?.toString()}
                                                                        onValueChange={(val) => amoForm.setValue(`mappings.${key}.statusId`, parseInt(val))}
                                                                        disabled={!amoForm.watch(`mappings.${key}.pipelineId`)}
                                                                    >
                                                                        <SelectTrigger className="h-8 text-xs flex-1">
                                                                            <SelectValue placeholder="Статус" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {pipelines?.find(p => p.id === amoForm.watch(`mappings.${key}.pipelineId`))
                                                                                ?._embedded.statuses.map(s => (
                                                                                    <SelectItem key={s.id} value={s.id.toString()}>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                                                                            {s.name}
                                                                                        </div>
                                                                                    </SelectItem>
                                                                                ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </details>
                                                <Button type="submit" className="w-full" disabled={connectAmo.isPending}>
                                                    {connectAmo.isPending ? 'Подключение' : 'Подключить'}
                                                </Button>
                                            </form>
                                        </DialogContent>
                                    </Dialog>

                                    {amoConnected && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleTestAmo}
                                                disabled={testAmo.isPending}
                                            >
                                                <RefreshCw className={`h-4 w-4 mr-2 ${testAmo.isPending ? 'animate-spin' : ''}`} />
                                                Проверить
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={handleDisconnectAmo}
                                                disabled={disconnectAmo.isPending}
                                            >
                                                Отключить
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div >
    );
}
