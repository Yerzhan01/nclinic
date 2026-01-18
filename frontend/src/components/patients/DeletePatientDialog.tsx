'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';

import { useDeletePatient } from '@/hooks/usePatients';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface Props {
    patientId: string;
    patientName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DeletePatientDialog({ patientId, patientName, open, onOpenChange }: Props) {
    const router = useRouter();
    const deletePatient = useDeletePatient();

    async function handleDelete() {
        try {
            await deletePatient.mutateAsync(patientId);
            toast.success(`Пациент ${patientName} удален`);
            onOpenChange(false);
            router.push('/patients');
        } catch (error) {
            console.error(error);
            toast.error('Ошибка при удалении пациента');
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Вы абсолютно уверены?</DialogTitle>
                    <DialogDescription>
                        Это действие нельзя отменить. Пациент <strong>{patientName}</strong> будет удален навсегда вместе со всей историей сообщений и прогрессом.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        disabled={deletePatient.isPending}
                    >
                        {deletePatient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Удалить
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
