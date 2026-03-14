import { useState, useEffect } from 'react';
import { InstitutionLayout } from '@/layouts/InstitutionLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Users,
    GraduationCap,
    School,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    IndianRupee,
    Activity
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { calculateWorkingDays, calculateAttendancePercentage } from '@/utils/attendanceUtils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function InstitutionAnalytics() {
    const { user } = useAuth();
    const { subscribeToTable } = useWebSocketContext();
    const queryClient = useQueryClient();

    // Check Role
    const role = (user as any)?.user_metadata?.role || user?.role;
    const isAccountant = role === 'accountant';

    const { data: analytics, isLoading: loading } = useQuery({
        queryKey: ['institution-analytics', user?.institutionId, role],
        queryFn: async () => {
            // 1. Fetch Students (Need class data for accountant too)
            const studentsQuery = supabase
                .from('students')
                .select('id, class_name, section'); // Fetch minimal fields needed

            if (user?.institutionId) {
                studentsQuery.eq('institution_id', user.institutionId);
            }

            const { data: studentsData, count: studentCount } = await studentsQuery; // Removed { count: 'exact', head: true } to get data

            // 2. Fetch Fees
            const { data: feesData } = await supabase
                .from('student_fees')
                .select('amount_paid, amount_due, student_id, status')
                .eq('institution_id', user!.institutionId);

            // 3. Fetch Institution Settings & Holidays for Overall Attendance
            // We use the text-based institutionId for academic_events and announcements
            const institutionTextId = user?.institutionId;
            const institutionUuid = (user as any)?.institutionUuid;

            const { data: instSettings } = await supabase
                .from('institutions')
                .select('*')
                .eq('institution_id', institutionTextId)
                .single();

            const { data: holidaysData } = await supabase
                .from('academic_events')
                .select('start_date, end_date')
                .eq('institution_id', institutionTextId) 
                .eq('event_type', 'holiday');

            const holidays: string[] = [];
            holidaysData?.forEach(h => {
                const start = new Date(h.start_date);
                const end = new Date(h.end_date);
                const current = new Date(start);
                while (current <= end) {
                    holidays.push(current.toISOString().split('T')[0]);
                    current.setDate(current.getDate() + 1);
                }
            });

            // 3.5 Fetch Announcement Holidays
            const { data: announcementData } = await supabase
                .from('announcements')
                .select('title, content, published_at')
                .eq('institution_id', institutionTextId) 
                .or('title.ilike.%holiday%,title.ilike.%leave%,title.ilike.%closed%,title.ilike.%rain%,content.ilike.%holiday%');

            const announcementHolidays = (announcementData || []).map(a => a.published_at?.split('T')[0]);

            // 4. Fetch Overall Attendance Count (Present)
            const { count: overallPresentCount } = await supabase
                .from('student_attendance')
                .select('*', { count: 'exact', head: true })
                .eq('institution_id', institutionTextId)
                .eq('status', 'present')
                .gte('attendance_date', instSettings?.academic_year_start || format(new Date(), 'yyyy-MM-dd'));

            // Common Stats
            const totalRev = feesData?.reduce((sum, item) => sum + (Number(item.amount_paid) || 0), 0) || 0;
            const totalDue = feesData?.reduce((sum, item) => sum + (Number(item.amount_due) || 0), 0) || 0;
            const outstanding = totalDue - totalRev;

            // --- ACCOUNTANT SPECIFIC PROCESSING ---
            let feeStats = null;
            if (isAccountant) {
                // Class-wise Breakdown
                const classMap: Record<string, { paid: number, pending: number }> = {};

                studentsData?.forEach(student => {
                    const className = student.class_name || 'Unassigned';
                    if (!classMap[className]) classMap[className] = { paid: 0, pending: 0 };

                    const sFees = feesData?.filter(f => f.student_id === student.id) || [];
                    const sPaid = sFees.reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);
                    const sDue = sFees.reduce((sum, f) => sum + (Number(f.amount_due) || 0), 0);

                    classMap[className].paid += sPaid;
                    classMap[className].pending += (sDue - sPaid);
                });

                const classChartData = Object.keys(classMap).map(cls => ({
                    name: cls,
                    Paid: classMap[cls].paid,
                    Pending: classMap[cls].pending
                }));

                // Status Distribution
                const statusCounts = { Paid: 0, Pending: 0, Overdue: 0 };
                feesData?.forEach(f => {
                    // Simple logic: if due > paid, it's pending. If 'overdue' status, it's overdue.
                    const p = Number(f.amount_paid) || 0;
                    const d = Number(f.amount_due) || 0;

                    if (f.status === 'overdue') statusCounts.Overdue++;
                    else if (p >= d && d > 0) statusCounts.Paid++;
                    else if (d > p) statusCounts.Pending++;
                });

                feeStats = {
                    classChartData,
                    statusChartData: [
                        { name: 'Paid', value: statusCounts.Paid },
                        { name: 'Pending', value: statusCounts.Pending },
                        { name: 'Overdue', value: statusCounts.Overdue }
                    ],
                    outstanding,
                    collectionRate: totalDue > 0 ? Math.round((totalRev / totalDue) * 100) : 0
                };
            }

            // --- INSTITUTION SPECIFIC PROCESSING (Keep existing logic mostly) ---
            // Only fetch these if NOT accountant to save resources? Or just fetch all.
            // For simplicity/mixed views, we'll fetch them.

            const [
                { count: facultyCount },
                { count: classCount },
                { data: deptData },
                { data: attendanceData }
            ] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('institution_id', user!.institutionId).in('role', ['faculty', 'teacher']),
                supabase.from('classes').select('*', { count: 'exact', head: true }).eq('institution_id', user!.institutionId),
                supabase.from('subjects').select('department').eq('institution_id', user!.institutionId),
                supabase.from('student_attendance')
                    .select('attendance_date, status')
                    .eq('institution_id', user!.institutionId)
                    .gte('attendance_date', format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'))
            ]);

            // Process Department Data
            const deptCounts: Record<string, number> = {};
            deptData?.forEach((d: any) => {
                const dept = d.department || 'General';
                deptCounts[dept] = (deptCounts[dept] || 0) + 1;
            });

            const deptChartData = Object.keys(deptCounts).map(k => ({
                name: k,
                value: deptCounts[k]
            }));

            // Process Attendance
            const attendanceByDate: Record<string, { present: number, total: number }> = {};
            attendanceData?.forEach(record => {
                const date = record.attendance_date;
                if (!attendanceByDate[date]) attendanceByDate[date] = { present: 0, total: 0 };
                attendanceByDate[date].total++;
                if (record.status === 'present' || record.status === 'late') attendanceByDate[date].present++;
            });

            const performanceData = Object.keys(attendanceByDate).sort().map(date => ({
                month: format(new Date(date), 'MMM dd'),
                attendance: Math.round((attendanceByDate[date].present / attendanceByDate[date].total) * 100),
                avg: 80
            }));

            // Calculate Overall Institution Attendance
            const workingDays = instSettings?.academic_year_start
                ? calculateWorkingDays(
                    new Date(instSettings.academic_year_start),
                    new Date(),
                    holidays,
                    true,
                    [], // Special dates excluded for overall metric as they vary by class
                    announcementHolidays
                )
                : 0;
            const totalPossibleManDays = workingDays * (studentCount || 0);
            const overallAttendance = calculateAttendancePercentage(overallPresentCount || 0, totalPossibleManDays);

            return {
                totalStudents: studentCount || 0,
                totalFaculty: facultyCount || 0,
                totalClasses: classCount || 0,
                totalRevenue: totalRev,
                deptChartData: deptChartData.length > 0 ? deptChartData : [{ name: 'No Data', value: 0 }],
                performanceData: performanceData,
                overallAttendance: overallAttendance,
                feeStats
            };
        },
        enabled: !!user?.institutionId,
        initialData: {
            totalStudents: 0,
            totalFaculty: 0,
            totalClasses: 0,
            totalRevenue: 0,
            deptChartData: [],
            performanceData: [],
            overallAttendance: '0%',
            feeStats: null
        }
    });

    // Real-time subscriptions
    useEffect(() => {
        if (!user?.institutionId) return;

        // Use specific filters for better performance and reliability
        const unsubStudents = subscribeToTable('students',
            () => queryClient.invalidateQueries({ queryKey: ['institution-analytics'] }),
            { filter: `institution_id=eq.${user.institutionId}` }
        );
        // ... (Keep existing subscriptions) ...
        const unsubFees = subscribeToTable('student_fees',
            () => queryClient.invalidateQueries({ queryKey: ['institution-analytics'] }),
            { filter: `institution_id=eq.${user.institutionId}` }
        );

        return () => {
            unsubStudents();
            unsubFees();
            // ... cleanup others
        };
    }, [user?.institutionId, subscribeToTable, queryClient]);


    if (isAccountant) {
        return (
            <InstitutionLayout>
                <PageHeader title="Financial Analytics" subtitle="Overview of fee collection and revenue" />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            <IndianRupee className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">₹{loading ? "..." : (analytics.totalRevenue / 1000).toFixed(1)}k</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                <ArrowUpRight className="w-3 h-3 text-success mr-1" />
                                +0% from last month
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Outstanding Amount</CardTitle>
                            <IndianRupee className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">₹{loading || !analytics.feeStats ? "..." : (analytics.feeStats.outstanding / 1000).toFixed(1)}k</div>
                            <p className="text-xs text-muted-foreground mt-1">Pending payments</p>
                        </CardContent>
                    </Card>
                    <Card className="sm:col-span-2 lg:col-span-1">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                            <TrendingUp className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading || !analytics.feeStats ? "..." : analytics.feeStats.collectionRate}%</div>
                            <p className="text-xs text-muted-foreground mt-1">of total due collected</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <Card className="col-span-1">
                        <CardHeader>
                            <CardTitle>Fee Status Distribution</CardTitle>
                            <CardDescription>Breakdown of payments</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analytics.feeStats?.statusChartData || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {(analytics.feeStats?.statusChartData || []).map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="col-span-1">
                        <CardHeader>
                            <CardTitle>Class-wise Collection</CardTitle>
                            <CardDescription>Paid vs Pending by Class</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.feeStats?.classChartData || []}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value / 1000}k`} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="Paid" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Pending" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </InstitutionLayout>
        );
    }

    // Default View (Institution Admin)
    return (
        <InstitutionLayout>
            <PageHeader
                title="Analytics Dashboard"
                subtitle="Overview of institution performance and statistics"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : analytics.totalStudents}</div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            <ArrowUpRight className="w-3 h-3 text-success mr-1" />
                            +0% from last month
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Faculty</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : analytics.totalFaculty}</div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            <Activity className="w-3 h-3 text-primary mr-1" />
                            Active
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{loading ? "..." : (analytics.totalRevenue / 1000).toFixed(1)}k</div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            <ArrowUpRight className="w-3 h-3 text-success mr-1" />
                            +0% from last month
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
                        <Activity className="h-4 w-4 text-success" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : analytics.overallAttendance}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Year-to-date average
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Attendance & Performance Trend</CardTitle>
                        <CardDescription>Live attendance data for the last 30 days</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.performanceData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} name="Avg Score" />
                                <Line type="monotone" dataKey="attendance" stroke="#10b981" strokeWidth={2} name="Attendance" />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Subject Distribution</CardTitle>
                        <CardDescription>Breakdown by Department (Based on Subjects)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={analytics.deptChartData || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {(analytics.deptChartData || []).map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </InstitutionLayout>
    );
}
