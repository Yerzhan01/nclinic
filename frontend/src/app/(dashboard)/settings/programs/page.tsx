"use client";

import { usePrograms, useCreateProgram, useDeleteProgram } from "@/hooks/usePrograms";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Edit } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function ProgramsPage() {
    const { data: programs, isLoading } = usePrograms();
    const deleteProgram = useDeleteProgram();
    const createProgram = useCreateProgram();
    const router = useRouter();

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newProgramName, setNewProgramName] = useState("");

    const handleCreate = async () => {
        if (!newProgramName) return;

        try {
            const newTemplate = await createProgram.mutateAsync({
                name: newProgramName,
                durationDays: 42, // Default
                isActive: true,
                rules: { schedule: [] }, // Empty schedule initially
            });
            setIsCreateOpen(false);
            setNewProgramName("");
            toast.success("Шаблон программы создан");
            router.push(`/settings/programs/${newTemplate.id}`);
        } catch (error) {
            toast.error("Не удалось создать шаблон");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteProgram.mutateAsync(id);
            toast.success("Шаблон удален");
        } catch (error) {
            toast.error("Не удалось удалить шаблон (возможно, он используется)");
        }
    };

    if (isLoading) return <div className="p-8">Загрузка программ...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Программы</h2>
                    <p className="text-muted-foreground">Управление шаблонами программ и расписанием.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Новый шаблон
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Создать новую программу</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Название программы</Label>
                                <Input
                                    placeholder="Например: Снижение веса (Стандарт)"
                                    value={newProgramName}
                                    onChange={(e) => setNewProgramName(e.target.value)}
                                />
                            </div>
                            <Button onClick={handleCreate} disabled={createProgram.isPending} className="w-full">
                                {createProgram.isPending ? "Создание..." : "Создать и настроить"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Шаблоны</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Название</TableHead>
                                <TableHead>Длительность</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead>Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {programs?.map((program) => (
                                <TableRow key={program.id}>
                                    <TableCell className="font-medium">{program.name}</TableCell>
                                    <TableCell>{program.durationDays} дней</TableCell>
                                    <TableCell>
                                        {program.isActive ? (
                                            <span className="text-green-600 font-semibold">Активен</span>
                                        ) : (
                                            <span className="text-gray-500">Неактивен</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="flex gap-2">
                                        <Link href={`/settings/programs/${program.id}`}>
                                            <Button variant="outline" size="sm">
                                                <Edit className="h-4 w-4 mr-1" /> Ред.
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700"
                                            onClick={() => handleDelete(program.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {programs?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        Программы не найдены. Создайте первую программу, чтобы начать.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
