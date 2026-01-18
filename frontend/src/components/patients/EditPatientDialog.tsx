'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Pencil } from 'lucide-react';

import { useUpdatePatient } from '@/hooks/usePatients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const formSchema = z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    phone: z.string().min(10, 'Phone must be at least 10 characters'),
    timezone: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
    patient: {
        id: string;
        fullName: string;
        phone: string;
        timezone: string;
    };
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditPatientDialog({ patient, open, onOpenChange }: Props) {
    const updatePatient = useUpdatePatient();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            fullName: patient.fullName,
            phone: patient.phone,
            timezone: patient.timezone,
        },
    });

    // Reset form when patient data changes
    useEffect(() => {
        form.reset({
            fullName: patient.fullName,
            phone: patient.phone,
            timezone: patient.timezone,
        });
    }, [patient, form]);

    async function onSubmit(values: FormValues) {
        try {
            await updatePatient.mutateAsync({
                id: patient.id,
                data: values,
            });
            toast.success('Данные пациента обновлены');
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error('Ошибка при обновлении. Возможно, номер телефона уже занят.');
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Редактировать пациента</DialogTitle>
                    <DialogDescription>
                        Измените основные данные пациента.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="fullName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>ФИО</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Номер телефона</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="timezone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Часовой пояс</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Выберите часовой пояс" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Asia/Almaty">Almaty (UTC+5)</SelectItem>
                                            <SelectItem value="Asia/Astana">Astana (UTC+5)</SelectItem>
                                            <SelectItem value="Asia/Tashkent">Tashkent (UTC+5)</SelectItem>
                                            <SelectItem value="Europe/Moscow">Moscow (UTC+3)</SelectItem>
                                            <SelectItem value="Europe/London">London (UTC+0)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" disabled={updatePatient.isPending}>
                                {updatePatient.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Сохранить
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
