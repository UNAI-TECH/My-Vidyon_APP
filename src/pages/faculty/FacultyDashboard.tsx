import { FacultyLayout } from '@/layouts/FacultyLayout';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { CourseCard } from '@/components/cards/CourseCard';
import { AdCard } from '@/components/cards/AdCard';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useFacultyDashboard } from '@/hooks/useFacultyDashboard';
import { useTranslation } from '@/i18n/TranslationContext';
import Loader from '@/components/common/Loader';
import {
  Users,
  BookOpen,
  FileCheck,
  UserCheck,
  Plus,
  Calendar,
  Clock,
  Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function FacultyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Use custom hook for real-time dashboard data
  const { stats, assignedSubjects, todaySchedule, isLoading } = useFacultyDashboard(
    user?.id,
    user?.institutionId
  );

  // No longer using intentional delay for loader

  if (isLoading) {
    return (
      <FacultyLayout>
        <Loader fullScreen={false} />
      </FacultyLayout>
    );
  }

  return (
    <FacultyLayout>
      <div className="pb-32 sm:pb-24">
        <PageHeader
          title={`${t.common.welcome}, ${user?.name?.split(' ')[0] || t.login.faculty}!`}
          subtitle={t.dashboard.overview}
        />

        {/* MyGate-style Shortcuts */}
        <section className="mb-8">
          <h3 className="text-lg font-bold mb-4 px-1">{t.dashboard.quickActions}</h3>
          <div className="shortcut-grid">
            <Link to="/faculty/attendance" className="shortcut-card">
              <div className="shortcut-icon-wrapper bg-blue-100 text-blue-600">
                <UserCheck className="w-6 h-6" />
              </div>
              <span className="shortcut-label">{t.nav.attendance}</span>
            </Link>
            <Link to="/faculty/timetable" className="shortcut-card">
              <div className="shortcut-icon-wrapper bg-purple-100 text-purple-600">
                <Calendar className="w-6 h-6" />
              </div>
              <span className="shortcut-label">{t.nav.timetable}</span>
            </Link>
            <Link to="/faculty/assignments" className="shortcut-card">
              <div className="shortcut-icon-wrapper bg-orange-100 text-orange-600">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="shortcut-label">{t.nav.assignments}</span>
            </Link>
            <Link to="/faculty/marks" className="shortcut-card">
              <div className="shortcut-icon-wrapper bg-green-100 text-green-600">
                <FileCheck className="w-6 h-6" />
              </div>
              <span className="shortcut-label">{t.nav.marks}</span>
            </Link>
            <Link to="/faculty/students" className="shortcut-card">
              <div className="shortcut-icon-wrapper bg-red-100 text-red-600">
                <Users className="w-6 h-6" />
              </div>
              <span className="shortcut-label">{t.nav.students}</span>
            </Link>
            <Link to="/faculty/leave" className="shortcut-card">
              <div className="shortcut-icon-wrapper bg-indigo-100 text-indigo-600">
                <Clock className="w-6 h-6" />
              </div>
              <span className="shortcut-label">{t.nav.leave}</span>
            </Link>
            <Link to="/faculty/announcements" className="shortcut-card">
              <div className="shortcut-icon-wrapper bg-yellow-100 text-yellow-600">
                <Plus className="w-6 h-6" />
              </div>
              <span className="shortcut-label">{t.nav.announcements}</span>
            </Link>
            <Link to="/faculty/settings" className="shortcut-card">
              <div className="shortcut-icon-wrapper bg-gray-100 text-gray-600">
                <Settings className="w-6 h-6" />
              </div>
              <span className="shortcut-label">{t.nav.settings}</span>
            </Link>
          </div>
        </section>

        <AdCard
          title="Upcoming Institution Meetups"
          description="Connect with other educators and stay updated with the latest institutional growth and teaching methodologies."
          Icon={Users}
          iconBgColor="bg-gradient-to-tr from-faculty to-blue-400 text-white"
          onClick={() => navigate('/faculty/calendar')}
          badgeText="Staff Update"
        />

        {/* Stats Grid - Real-time Data */}
        <div className="stats-grid mb-6 sm:mb-8">
          <StatCard
            title={t.faculty.totalStudents}
            value={stats.totalStudents}
            icon={Users}
            iconColor="text-faculty"
            change="Whole Institution"
          />
          <StatCard
            title="My Students"
            value={stats.myStudents}
            icon={Users}
            iconColor="text-primary"
            change="In assigned classes"
          />
          <StatCard
            title={t.institution.activeCourses}
            value={stats.activeSubjects}
            icon={BookOpen}
            iconColor="text-success"
            change={`${stats.todayClasses} classes today`}
          />
          <StatCard
            title="Avg. Attendance"
            value={stats.avgAttendance}
            icon={UserCheck}
            iconColor="text-warning"
            change="+2% this week"
            changeType="positive"
          />
          <StatCard
            title={t.faculty.pendingGrading}
            value={stats.pendingReviews}
            icon={FileCheck}
            iconColor="text-destructive"
            change="Leave Requests"
            onClick={() => navigate('/faculty/student-leaves')}
            className="cursor-pointer hover:shadow-md transition-shadow"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Today's Schedule - Real-time Data */}
          <div className="xl:col-span-2 dashboard-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <h3 className="font-semibold text-sm sm:text-base">Today's Schedule</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>

            {todaySchedule.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No classes scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {todaySchedule.map((item, index) => (
                  <div key={index} className="flex gap-3 sm:gap-4 p-2.5 sm:p-3 bg-muted/50 rounded-lg border border-border/50">
                    <div className="text-xs sm:text-sm font-medium text-primary w-20 sm:w-28 flex-shrink-0">
                      {item.time}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm truncate">{item.subject}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {item.class} - Section {item.section}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">
                        Room: {item.room}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="dashboard-card p-4 sm:p-6">
            <h3 className="font-semibold text-sm sm:text-base mb-3 sm:mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/faculty/timetable')}
              >
                <Calendar className="w-4 h-4 mr-2" />
                View Full Timetable
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/faculty/attendance')}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Mark Attendance
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/faculty/assignments')}
              >
                <FileCheck className="w-4 h-4 mr-2" />
                Manage Assignments
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => navigate('/faculty/student-leaves')}
              >
                <Clock className="w-4 h-4 mr-2" />
                Review Leave Requests
                {stats.pendingReviews > 0 && (
                  <span className="ml-auto bg-destructive text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {stats.pendingReviews}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* My Subjects - Real-time Data */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="font-semibold text-sm sm:text-base">My Subjects</h3>
            <a href="/faculty/subjects" className="text-xs sm:text-sm text-primary hover:underline">
              Manage Subjects
            </a>
          </div>

          {assignedSubjects.length === 0 ? (
            <div className="dashboard-card p-8 text-center text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No subjects assigned yet</p>
              <p className="text-xs mt-1">Contact your admin to assign subjects</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {assignedSubjects.map((subject) => (
                <CourseCard
                  key={subject.id}
                  title={subject.subjectName}
                  code={subject.className}
                  instructor="You"
                  students={subject.studentCount || 0}
                  schedule={`Section ${subject.section}`}
                  status="active"
                />
              ))}
            </div>
          )}
        </div>

        {/* Real-time Update Indicator */}
        <div className="fixed bottom-20 sm:bottom-4 right-4 bg-success/10 text-success px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-2 z-[60] backdrop-blur-sm border border-success/20">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
          Live Updates Active
        </div>
      </div>
    </FacultyLayout>
  );
}
