import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProblemPatient } from "@/api/analytics.api";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function ProblemPatientsTable({ data }: { data: ProblemPatient[] }) {
    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>Проблемные пациенты</CardTitle>
                <CardDescription>
                    Пациенты с высоким риском или зависшими задачами
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Пациент</TableHead>
                            <TableHead className="text-center">Риски</TableHead>
                            <TableHead className="text-center">Задачи</TableHead>
                            <TableHead className="text-right">Max простой</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    Нет проблемных пациентов
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((patient) => (
                                <TableRow key={patient.patientId}>
                                    <TableCell className="font-medium">{patient.patientName}</TableCell>
                                    <TableCell className="text-center">
                                        {patient.riskAlerts > 0 ? (
                                            <Badge variant="destructive">{patient.riskAlerts}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {patient.openTasks}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {patient.oldestTaskHours > 24 ? (
                                            <span className="text-red-500 font-bold">{patient.oldestTaskHours} ч</span>
                                        ) : (
                                            <span>{patient.oldestTaskHours} ч</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/patients/${patient.patientId}?tab=tasks`}>
                                            <Button variant="ghost" size="icon">
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
