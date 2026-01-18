'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';

import { useDeletePatient } from '@/hooks/usePatients';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Вы абсолютно уверены?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Это действие нельзя отменить. Пациент <strong>{patientName}</strong> будет удален навсегда вместе со всей историей сообщений и прогрессом.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deletePatient.isPending}
                    >
                        {deletePatient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Удалить
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
