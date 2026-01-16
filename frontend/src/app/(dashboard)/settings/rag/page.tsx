'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Search, FileText, Database, ChevronRight, Save } from 'lucide-react';

import {
    useRagSources,
    useCreateRagSource,
    useDeleteRagSource,
    useRagDocuments,
    useCreateRagDocument,
    useDeleteRagDocument,
    useUpdateRagDocument,
    useRagSearch,
    type RagSource,
    type RagDocument
} from '@/hooks/useRag';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function RagAdminPage() {
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('documents');

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Database className="h-6 w-6" />
                    RAG Knowledge Base
                </h1>
                <p className="text-muted-foreground">Управление базой знаний для AI-ассистента</p>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 h-full min-h-0">
                {/* Left Sidebar: Sources */}
                <Card className="col-span-3 h-full flex flex-col">
                    <CardHeader className="py-3 px-4 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">Источники</CardTitle>
                            <CreateSourceDialog />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 min-h-0">
                        <SourcesList
                            selectedId={selectedSource}
                            onSelect={setSelectedSource}
                        />
                    </CardContent>
                </Card>

                {/* Main Content: Documents or Search */}
                <Card className="col-span-9 h-full flex flex-col">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                        <div className="border-b px-4 py-2 flex items-center justify-between">
                            <TabsList>
                                <TabsTrigger value="documents" disabled={!selectedSource}>Документы</TabsTrigger>
                                <TabsTrigger value="search">Тест Поиска</TabsTrigger>
                            </TabsList>
                            {activeTab === 'documents' && selectedSource && (
                                <CreateDocumentDialog sourceId={selectedSource} />
                            )}
                        </div>

                        <CardContent className="flex-1 p-0 min-h-0 relative">
                            <TabsContent value="documents" className="h-full m-0">
                                {selectedSource ? (
                                    <DocumentsList sourceId={selectedSource} />
                                ) : (
                                    <div className="h-full flex items-center justify-center text-muted-foreground">
                                        Выберите источник слева
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="search" className="h-full m-0 p-4">
                                <SearchTester />
                            </TabsContent>
                        </CardContent>
                    </Tabs>
                </Card>
            </div>
        </div>
    );
}

// --- Sub-components ---

function SourcesList({ selectedId, onSelect }: { selectedId: string | null, onSelect: (id: string) => void }) {
    const { data: sources, isLoading } = useRagSources();
    const deleteSource = useDeleteRagSource();

    if (isLoading) return <div className="p-4"><Loader2 className="animate-spin" /></div>;

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Удалить источник и все документы?')) {
            deleteSource.mutate(id);
            if (selectedId === id) onSelect('');
        }
    };

    return (
        <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
                {sources?.map(source => (
                    <div
                        key={source.id}
                        onClick={() => onSelect(source.id)}
                        className={cn(
                            "group flex items-center justify-between px-3 py-2 rounded-md text-sm cursor-pointer hover:bg-muted transition-colors",
                            selectedId === source.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                        )}
                    >
                        <div className="flex items-center gap-2 truncate">
                            <ChevronRight className={cn("h-3 w-3 transition-transform", selectedId === source.id && "rotate-90")} />
                            <span className="truncate">{source.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] h-5 px-1">{source._count?.documents || 0}</Badge>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                onClick={(e) => handleDelete(e, source.id)}
                            >
                                <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}

function CreateSourceDialog() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const createSource = useCreateRagSource();

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createSource.mutateAsync(name);
            setOpen(false);
            setName('');
            toast.success('Источник создан');
        } catch {
            toast.error('Ошибка создания');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-4 w-4" /></Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Новый источник</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Название</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Например: Прейскурант" required />
                    </div>
                    <Button type="submit" disabled={createSource.isPending} className="w-full">Создать</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DocumentsList({ sourceId }: { sourceId: string }) {
    const { data: documents, isLoading } = useRagDocuments(sourceId);
    const deleteDoc = useDeleteRagDocument();

    // Edit mode state
    const [editingDoc, setEditingDoc] = useState<RagDocument | null>(null);

    if (isLoading) return <div className="p-4"><Loader2 className="animate-spin" /></div>;

    if (editingDoc) {
        return <EditDocumentForm doc={editingDoc} onCancel={() => setEditingDoc(null)} />;
    }

    return (
        <ScrollArea className="h-full">
            <div className="p-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {documents?.map(doc => (
                    <Card key={doc.id} className="hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => setEditingDoc(doc)}>
                        <CardHeader className="p-4 space-y-1">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium leading-none truncate pr-4" title={doc.title}>
                                    {doc.title}
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 -mr-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Удалить документ?')) deleteDoc.mutate({ id: doc.id, sourceId });
                                    }}
                                >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                            </div>
                            <CardDescription className="text-xs truncate">
                                {doc.content.substring(0, 100)}...
                            </CardDescription>
                        </CardHeader>
                    </Card>
                ))}
                {documents?.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        Нет документов. Добавьте первый!
                    </div>
                )}
            </div>
        </ScrollArea>
    );
}

function CreateDocumentDialog({ sourceId }: { sourceId: string }) {
    const [open, setOpen] = useState(false);
    const { register, handleSubmit, reset } = useForm<{ title: string; content: string }>();
    const createDoc = useCreateRagDocument();

    const onSubmit = async (data: { title: string; content: string }) => {
        try {
            await createDoc.mutateAsync({ sourceId, ...data });
            setOpen(false);
            reset();
            toast.success('Документ добавлен');
        } catch {
            toast.error('Ошибка добавления');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Добавить документ</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Новый документ</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Заголовок</Label>
                        <Input {...register('title')} required placeholder="Вопрос или тема" />
                    </div>
                    <div className="space-y-2">
                        <Label>Содержание</Label>
                        <Textarea {...register('content')} required rows={10} placeholder="Текст ответа или статьи..." />
                    </div>
                    <Button type="submit" disabled={createDoc.isPending} className="w-full">Сохранить</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditDocumentForm({ doc, onCancel }: { doc: RagDocument, onCancel: () => void }) {
    const { register, handleSubmit } = useForm({ defaultValues: { title: doc.title, content: doc.content } });
    const updateDoc = useUpdateRagDocument();

    const onSubmit = async (data: { title: string; content: string }) => {
        try {
            await updateDoc.mutateAsync({ id: doc.id, ...data });
            toast.success('Документ обновлен');
            onCancel();
        } catch {
            toast.error('Ошибка обновления');
        }
    };

    return (
        <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={onCancel} className="gap-2">
                    <ChevronRight className="h-4 w-4 rotate-180" /> Назад
                </Button>
                <h3 className="font-medium">Редактирование</h3>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col gap-4">
                <div className="space-y-2">
                    <Label>Заголовок</Label>
                    <Input {...register('title')} required />
                </div>
                <div className="space-y-2 flex-1 flex flex-col">
                    <Label>Содержание</Label>
                    <Textarea {...register('content')} required className="flex-1 resize-none font-mono text-sm" />
                </div>
                <Button type="submit" disabled={updateDoc.isPending}>
                    <Save className="mr-2 h-4 w-4" /> Сохранить изменения
                </Button>
            </form>
        </div>
    );
}

function SearchTester() {
    const [query, setQuery] = useState('');
    const search = useRagSearch();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) search.mutate(query);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
                <h3 className="text-lg font-medium">Тестирование поиска</h3>
                <p className="text-sm text-muted-foreground">Проверьте, какие документы находит AI по запросу</p>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Введите вопрос пациента..."
                    className="flex-1"
                />
                <Button type="submit" disabled={search.isPending}>
                    {search.isPending ? <Loader2 className="animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
            </form>

            <div className="space-y-4">
                {search.data?.map((result, i) => (
                    <Card key={i}>
                        <CardHeader className="py-3 px-4 bg-muted/30">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-sm flex items-center gap-2">
                                    <FileText className="h-3 w-3" />
                                    {result.title}
                                </span>
                                <Badge variant="outline" className="text-xs">{result.sourceName}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 text-sm text-muted-foreground whitespace-pre-wrap">
                            {result.contentSnippet}
                        </CardContent>
                    </Card>
                ))}

                {search.isSuccess && search.data?.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                        Ничего не найдено
                    </div>
                )}
            </div>
        </div>
    );
}
