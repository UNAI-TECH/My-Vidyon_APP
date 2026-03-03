import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { InstitutionLayout } from '@/layouts/InstitutionLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { IndianRupee, TrendingUp, Users, AlertCircle, ArrowUpRight, Wifi, WifiOff, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/common/Badge';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AdCard } from '@/components/cards/AdCard';
import { ShieldCheck } from 'lucide-react';

const COLORS = ['#10b981', '#ef4444', '#f59e0b'];

export function AccountantDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isRealTimeConnected, setIsRealTimeConnected] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    const { data: stats, isLoading, refetch } = useQuery({
        queryKey: ['accountant-dashboard-stats', user?.institutionId],
        queryFn: async () => {
            if (!user?.institutionId) return null;

            // Parallel Fetching
            const [feesReq, studentsReq] = await Promise.all([
                supabase.from('student_fees').select('amount_paid, amount_due, status').eq('institution_id', user.institutionId),
                supabase.from('students').select('id', { count: 'exact', head: true }).eq('institution_id', user.institutionId),
            ]);

            const fees = feesReq.data || [];
            const totalRev = fees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);
            const totalDue = fees.reduce((sum, f) => sum + (Number(f.amount_due) || 0), 0);
            const outstanding = totalDue - totalRev;

            let paidCount = 0;
            let pendingCount = 0;
            let overdueCount = 0;

            fees.forEach(f => {
                const p = Number(f.amount_paid) || 0;
                const d = Number(f.amount_due) || 0;
                if (f.status === 'overdue') overdueCount++;
                else if (d > p) pendingCount++;
                else paidCount++;
            });

            return {
                revenue: totalRev,
                outstanding: outstanding,
                studentCount: studentsReq.count || 0,
                collectionRate: totalDue > 0 ? Math.round((totalRev / totalDue) * 100) : 0,
                pieData: [
                    { name: 'Fully Paid', value: paidCount },
                    { name: 'Pending', value: pendingCount },
                    { name: 'Overdue', value: overdueCount }
                ].filter(d => d.value > 0)
            };
        },
        enabled: !!user?.institutionId,
        refetchInterval: 30000, // Fallback: refetch every 30 seconds
    });

    // Real-time subscription for student_fees changes
    useEffect(() => {
        if (!user?.institutionId) return;

        console.log('[REALTIME] Setting up subscriptions for accountant dashboard');

        // Subscribe to student_fees changes
        const feesChannel = supabase
            .channel('accountant-fees-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'student_fees',
                    filter: `institution_id=eq.${user.institutionId}`
                },
                (payload) => {
                    console.log('[REALTIME] Fee change detected:', payload);
                    setLastUpdate(new Date());
                    refetch();

                    // Show toast notification
                    if (payload.eventType === 'INSERT') {
                        toast.success('New fee record added', {
                            description: 'Dashboard updated automatically'
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        toast.info('Fee record updated', {
                            description: 'Dashboard refreshed'
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log('[REALTIME] Fees subscription status:', status);
                setIsRealTimeConnected(status === 'SUBSCRIBED');
            });

        // Subscribe to students changes (for student count)
        const studentsChannel = supabase
            .channel('accountant-students-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'students',
                    filter: `institution_id=eq.${user.institutionId}`
                },
                (payload) => {
                    console.log('[REALTIME] Student change detected:', payload);
                    setLastUpdate(new Date());
                    refetch();

                    if (payload.eventType === 'INSERT') {
                        toast.success('New student enrolled', {
                            description: 'Dashboard updated'
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log('[REALTIME] Students subscription status:', status);
            });

        // Cleanup subscriptions on unmount
        return () => {
            console.log('[REALTIME] Cleaning up subscriptions');
            supabase.removeChannel(feesChannel);
            supabase.removeChannel(studentsChannel);
        };
    }, [user?.institutionId, refetch]);

    return (
        <InstitutionLayout>
            <PageHeader
                title="Accountant Dashboard"
                subtitle={
                    <div className="flex items-center gap-2">
                        <span>Financial overview and quick actions</span>
                        <Badge
                            variant={isRealTimeConnected ? "success" : "warning"}
                            className="text-xs"
                        >
                            {isRealTimeConnected ? (
                                <>
                                    <Wifi className="w-3 h-3 mr-1" />
                                    Live
                                </>
                            ) : (
                                <>
                                    <WifiOff className="w-3 h-3 mr-1" />
                                    Offline
                                </>
                            )}
                        </Badge>
                    </div>
                }
                actions={
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                            Updated: {lastUpdate.toLocaleTimeString()}
                        </span>
                        <Button variant="outline" className="gap-2" onClick={() => navigate('/accountant/fees?action=manual-bill')}>
                            <Plus className="w-4 h-4" /> Quick Bill
                        </Button>
                        <Button onClick={() => navigate('/accountant/fees')}>Manage Fees</Button>
                    </div>
                }
            />

            {/* Stats Row */}
            <div className="stats-grid mb-6 sm:mb-8">
                <StatCard
                    title="Total Revenue"
                    value={`₹${(stats?.revenue || 0).toLocaleString()}`}
                    icon={IndianRupee}
                    iconColor="text-success"
                    change="Year to Date"
                />
                <StatCard
                    title="Outstanding Dues"
                    value={`₹${(stats?.outstanding || 0).toLocaleString()}`}
                    icon={AlertCircle}
                    iconColor="text-destructive"
                    change="Pending Collection"
                />
                <StatCard
                    title="Collection Rate"
                    value={`${stats?.collectionRate || 0}%`}
                    icon={TrendingUp}
                    iconColor="text-primary"
                    change="Of total expected"
                />
                <StatCard
                    title="Total Students"
                    value={stats?.studentCount || 0}
                    icon={Users}
                    iconColor="text-muted-foreground"
                    change="Enrolled"
                />
            </div>

            <AdCard
                title="Professional Tax Accounting Made Easy"
                description="Streamline your institutional tax filings and audits with our partner financial compliance tools."
                Icon={ShieldCheck}
                iconBgColor="bg-gradient-to-tr from-blue-500 to-cyan-600 text-white"
                badgeText="Financial Tool"
            />

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                {/* Payment Status Chart */}
                <Card className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
                    <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
                        <CardTitle className="text-base sm:text-lg">Fee Status Distribution</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Breakdown of student fee records</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px] sm:h-[300px] px-3 sm:px-6 pb-4 sm:pb-6">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground">Loading...</div>
                        ) : stats?.pieData && stats.pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => [value, 'Students']}
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">No fee records found</div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Actions / Recent (Placeholder for now) */}
                <Card className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
                    <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
                        <CardTitle className="text-base sm:text-lg">Recent Transactions</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Latest fee payments recorded</CardDescription>
                    </CardHeader>
                    <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
                        <div className="space-y-4">
                            {/* In future, fetch actual transactions table. For now, a placeholder illustrative empty state */}
                            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                                    <IndianRupee className="w-6 h-6 opacity-30" />
                                </div>
                                <p className="text-sm">No recent transactions to display</p>
                                <Button variant="link" onClick={() => navigate('/accountant/fees')} className="mt-2 text-primary">Record a Payment</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </InstitutionLayout>
    );
}
