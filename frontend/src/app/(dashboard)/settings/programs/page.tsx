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
            toast.success("Program template created");
            router.push(`/settings/programs/${newTemplate.id}`);
        } catch (error) {
            toast.error("Failed to create template");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this template?")) return;
        try {
            await deleteProgram.mutateAsync(id);
            toast.success("Template deleted");
        } catch (error) {
            toast.error("Failed to delete template (it might be in use)");
        }
    };

    if (isLoading) return <div className="p-8">Loading programs...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Programs</h2>
                    <p className="text-muted-foreground">Manage program templates and schedules.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> New Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Program</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Program Name</Label>
                                <Input
                                    placeholder="e.g. Weight Loss Standard"
                                    value={newProgramName}
                                    onChange={(e) => setNewProgramName(e.target.value)}
                                />
                            </div>
                            <Button onClick={handleCreate} disabled={createProgram.isPending} className="w-full">
                                {createProgram.isPending ? "Creating..." : "Create & Edit"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Templates</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {programs?.map((program) => (
                                <TableRow key={program.id}>
                                    <TableCell className="font-medium">{program.name}</TableCell>
                                    <TableCell>{program.durationDays} days</TableCell>
                                    <TableCell>
                                        {program.isActive ? (
                                            <span className="text-green-600 font-semibold">Active</span>
                                        ) : (
                                            <span className="text-gray-500">Inactive</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="flex gap-2">
                                        <Link href={`/settings/programs/${program.id}`}>
                                            <Button variant="outline" size="sm">
                                                <Edit className="h-4 w-4 mr-1" /> Edit
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
                                        No programs found. Create one to get started.
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
