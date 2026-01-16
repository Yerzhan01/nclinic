import { useCheckIns } from '@/hooks/useCheckIns';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';

interface CheckInSummaryProps {
    patientId: string;
}

export function CheckInSummary({ patientId }: CheckInSummaryProps) {
    const { generateSummary } = useCheckIns(patientId);

    const handleGenerate = () => {
        generateSummary.mutate();
    };

    const result = generateSummary.data;

    return (
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 border-indigo-100 dark:border-slate-700">
            <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                    <Sparkles className="w-5 h-5" />
                    AI Coach Summary
                </CardTitle>
            </CardHeader>
            <CardContent>
                {!result ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                        Generate a progress report based on recent check-ins.
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2 text-green-700 dark:text-green-400">
                                <CheckCircle className="w-4 h-4" /> Progress
                            </h4>
                            <p className="text-sm">{result.progress}</p>
                        </div>

                        {result.issues && result.issues.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                    <AlertCircle className="w-4 h-4" /> Attention Needed
                                </h4>
                                <ul className="text-sm list-disc pl-5 space-y-1">
                                    {result.issues.map((issue, i) => (
                                        <li key={i}>{issue}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="space-y-2 pt-2 border-t border-indigo-100 dark:border-slate-700">
                            <h4 className="text-sm font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                                <ArrowRight className="w-4 h-4" /> Next Step
                            </h4>
                            <p className="text-sm font-medium">{result.nextStep}</p>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button
                    onClick={handleGenerate}
                    disabled={generateSummary.isPending}
                    variant="default"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                    {generateSummary.isPending ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        result ? 'Regenerate Summary' : 'Generate Summary'
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
}
