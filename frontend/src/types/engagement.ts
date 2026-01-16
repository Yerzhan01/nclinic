export interface EngagementScore {
    score: number;
    status: 'OK' | 'AT_RISK' | 'HIGH_RISK';
    factors: string[];
}

export interface EngagementAnalytics {
    ok: number;
    atRisk: number;
    highRisk: number;
}
