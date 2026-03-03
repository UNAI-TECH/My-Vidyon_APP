import { StudentLayout } from '@/layouts/StudentLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/common/Badge';
import { AreaChart } from '@/components/charts/AreaChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { useTranslation } from '@/i18n/TranslationContext';
import { CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { format } from 'date-fns';
import { AdCard } from '@/components/cards/AdCard';
import { BookOpenCheck } from 'lucide-react';

export function StudentAttendance() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 1. Fetch Student Profile
  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      console.log('🔍 [ATTENDANCE-DIAG] Fetching profile for email:', user.email);
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .ilike('email', user.email.trim())
        .maybeSingle();

      if (error) {
        console.error('❌ [ATTENDANCE-DIAG] Profile Fetch Error:', error);
        return null;
      }
      console.log('✅ [ATTENDANCE-DIAG] Profile Found:', data ? { id: data.id, name: data.name, email: data.email } : 'NONE');
      return data;
    },
    enabled: !!user?.email,
  });

  const today = format(new Date(), 'yyyy-MM-dd');

  // 2. Fetch Attendance History
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['student-attendance-history', studentProfile?.id, today],
    queryFn: async () => {
      if (!studentProfile?.id) return [];
      console.log('🔍 [ATTENDANCE-DIAG] Fetching history for student_id:', studentProfile.id);
      const { data, error } = await supabase
        .from('student_attendance')
        .select('*')
        .eq('student_id', studentProfile?.id)
        .order('attendance_date', { ascending: false });

      if (error) {
        console.error('❌ [ATTENDANCE-DIAG] History Fetch Error:', error);
        return [];
      }
      console.log('✅ [ATTENDANCE-DIAG] History Records Found:', data?.length || 0);

      return (data || []).map(record => ({
        id: record.id,
        date: new Date(record.attendance_date).toLocaleDateString(),
        course: 'General Attendance', // Default unless subject-wise is implemented
        status: record.status,
        time: new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
    },
    enabled: !!studentProfile?.id,
  });

  // 3. Real-time Subscription
  useEffect(() => {
    if (!studentProfile?.id) return;

    const channel = supabase.channel('student-attendance-personal')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_attendance',
        filter: `student_id=eq.${studentProfile.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['student-attendance-history'] });
        queryClient.invalidateQueries({ queryKey: ['student-attendance-rate'] }); // From dashboard
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [studentProfile?.id, queryClient]);

  // 4. Calculate Stats & Chart Data
  const presentCount = history.filter(h => h.status === 'present' || h.status === 'late').length;
  const absentCount = history.filter(h => h.status === 'absent').length;
  const attendanceRate = history.length > 0 ? Math.round((presentCount / history.length) * 100) : 0;

  // Calculate Streak (consecutive presence)
  let streak = 0;
  for (const record of history) {
    if (record.status === 'present' || record.status === 'late') {
      streak++;
    } else if (record.status === 'absent') {
      break;
    }
  }

  // Generate Weekly Trend (Last 7 days)
  const chartData = [...history].reverse().slice(-7).map(h => ({
    name: h.date.split('/')[0] + '/' + h.date.split('/')[1], // Simple day/month format
    value: (h.status === 'present' || h.status === 'late') ? 100 : 0
  }));

  const columns = [
    { key: 'date', header: 'Date' },
    { key: 'course', header: 'Type' },
    { key: 'time', header: 'Time' },
    {
      key: 'status',
      header: 'Status',
      render: (item: any) => {
        const config = {
          present: { variant: 'success' as const, icon: CheckCircle },
          absent: { variant: 'destructive' as const, icon: XCircle },
          late: { variant: 'warning' as const, icon: Clock },
        };
        const status = (item.status || 'absent').toLowerCase() as keyof typeof config;
        const { variant, icon: Icon } = config[status] || config.absent;
        return (
          <Badge variant={variant} className="flex items-center gap-1 w-fit">
            <Icon className="w-3 h-3" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
  ];

  return (
    <StudentLayout>
      <PageHeader
        title={t.nav.attendance}
        subtitle={t.dashboard.overview}
      />

      <AdCard
        title="Stay Consistent, Stay Ahead!"
        description="Students with over 90% attendance are 2x more likely to excel in final exams. See our latest study tips."
        Icon={BookOpenCheck}
        iconBgColor="bg-gradient-to-tr from-green-400 to-emerald-600 text-white"
        badgeText="Study Tip"
        variant="compact"
        className="mb-6"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <StatCard
          title="Overall Attendance"
          value={`${attendanceRate}%`}
          icon={CheckCircle}
          iconColor="text-success"
          change={attendanceRate >= 75 ? "Above 75% minimum" : "Warning: Below 75%"}
          changeType={attendanceRate >= 75 ? "positive" : "negative"}
        />
        <StatCard
          title="Days Present"
          value={presentCount}
          icon={Calendar}
          iconColor="text-primary"
          change={`Out of ${history.length} recorded days`}
        />
        <StatCard
          title="Days Absent"
          value={absentCount}
          icon={XCircle}
          iconColor="text-destructive"
          change="Recognized by System"
        />
        <StatCard
          title="Presence Streak"
          value={streak > 0 ? `${streak} Days` : "0 Days"}
          icon={Clock}
          iconColor="text-warning" change="Consecutive Present"
          changeType="positive"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="lg:col-span-2 dashboard-card p-4 lg:p-6">
          <h3 className="font-semibold mb-4 text-base lg:text-lg">Daily Attendance Log (Last 7 Entries)</h3>
          {chartData.length > 0 ? (
            <AreaChart data={chartData} color="hsl(var(--success))" height={280} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 lg:py-20 opacity-50">
              <Calendar className="w-10 h-10 mb-2" />
              <p className="text-sm italic">Not enough data for trend</p>
            </div>
          )}
        </div>
        <div className="dashboard-card p-4 lg:p-6">
          <h3 className="font-semibold mb-4 text-base lg:text-lg">Attendance Share</h3>
          <DonutChart data={[
            { name: 'Present/Late', value: presentCount },
            { name: 'Absent', value: absentCount }
          ]} height={280} />
        </div>
      </div>

      {/* Recent Attendance */}
      <div className="dashboard-card p-4 lg:p-6">
        <h3 className="font-semibold mb-4 text-base lg:text-lg">Recent Attendance Records</h3>
        <DataTable columns={columns} data={history} loading={isLoading} mobileCardView={true} />
      </div>
    </StudentLayout>
  );
}
