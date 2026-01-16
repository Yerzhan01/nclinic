'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Plus, UserPlus } from 'lucide-react';

import { useCreatePatient, useProgramTemplates } from '@/hooks/usePatients';
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
    FormDescription,
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
    templateId: z.string().optional(),
    timezone: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export function CreatePatientDialog() {
    const [open, setOpen] = useState(false);
    const createPatient = useCreatePatient();
    const { data: templates } = useProgramTemplates();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            fullName: '',
            phone: '',
            templateId: undefined,
            timezone: 'Asia/Almaty',
        },
    });

    async function onSubmit(values: FormValues) {
        try {
            await createPatient.mutateAsync(values);
            toast.success(`Пациент ${values.fullName} успешно создан`);
            setOpen(false);
            form.reset();
        } catch (error) {
            console.error(error);
            toast.error('Ошибка при создании. Проверьте номер телефона (должен быть уникальным).');
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Добавить пациента
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Добавить нового пациента</DialogTitle>
                    <DialogDescription>
                        Создайте карточку пациента. Можно сразу назначить программу.
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
                                        <Input placeholder="Иванов Иван" {...field} />
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
                                        <Input placeholder="+7777..." {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Уникальный номер. Формат: +7...
                                    </FormDescription>
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

                        <FormField
                            control={form.control}
                            name="templateId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Назначить программу (опционально)</FormLabel>
                                    <Select
                                        onValueChange={(val) => field.onChange(val === 'none' ? undefined : val)}
                                        defaultValue={field.value || 'none'}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Выберите программу..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">Без программы</SelectItem>
                                            {templates?.map((t) => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    {t.name} ({t.durationDays} дней)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Программа начнется автоматически с сегодняшнего дня.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" disabled={createPatient.isPending}>
                                {createPatient.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Создать пациента
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
