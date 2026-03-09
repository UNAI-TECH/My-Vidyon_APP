import { ParentLayout } from '@/layouts/ParentLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/i18n/TranslationContext';
import { useParentDashboard } from '@/hooks/useParentDashboard';
import { Phone, Shield, School, User, Calendar, CreditCard, AlertCircle, Clock, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/common/Badge';
import { AdPlaceholder } from '@/components/common/AdPlaceholder';

export function ParentDashboard() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const { stats, children, childrenAttendance, leaveRequests, feeData, specialClasses } = useParentDashboard(
        user?.id,
        user?.institutionId
    );

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleAttendanceClick = () => {
        if (children && children.length > 0) {
            // Navigate to the first child's attendance tab
            navigate(`/parent/child/${children[0].id}?tab=attendance`);
        } else {
            navigate('/parent'); // Stay here if no children
        }
    };

    return (
        <ParentLayout>
            <PageHeader
                title={`${t.common.welcome}, ${user?.name}!`}
                subtitle="Monitor your children's progress"
            />

            {/* MyGate-style Shortcuts */}
            <section className="mb-8 mt-6">
                <h3 className="text-lg font-bold mb-4 px-1">Quick Services</h3>
                <div className="shortcut-grid">
                    <button className="shortcut-card" onClick={() => scrollToSection('children-section')}>
                        <div className="shortcut-icon-wrapper bg-blue-100 text-blue-600">
                            <User className="w-6 h-6" />
                        </div>
                        <span className="shortcut-label">Children</span>
                    </button>
                    <button className="shortcut-card" onClick={() => navigate('/parent/fees')}>
                        <div className="shortcut-icon-wrapper bg-green-100 text-green-600">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <span className="shortcut-label">Pay Fees</span>
                    </button>
                    <button className="shortcut-card" onClick={() => navigate('/parent/leave')}>
                        <div className="shortcut-icon-wrapper bg-purple-100 text-purple-600">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <span className="shortcut-label">Leave App</span>
                    </button>
                    <button className="shortcut-card" onClick={handleAttendanceClick}>
                        <div className="shortcut-icon-wrapper bg-orange-100 text-orange-600">
                            <Clock className="w-6 h-6" />
                        </div>
                        <span className="shortcut-label">Attendance</span>
                    </button>
                    <button className="shortcut-card" onClick={() => scrollToSection('emergency-section')}>
                        <div className="shortcut-icon-wrapper bg-red-100 text-red-600">
                            <Shield className="w-6 h-6" />
                        </div>
                        <span className="shortcut-label">Security</span>
                    </button>
                    <button className="shortcut-card" onClick={() => navigate('/parent/exam-schedule')}>
                        <div className="shortcut-icon-wrapper bg-indigo-100 text-indigo-600">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <span className="shortcut-label">Exam Schedule</span>
                    </button>
                    <button className="shortcut-card" onClick={() => scrollToSection('emergency-section')}>
                        <div className="shortcut-icon-wrapper bg-yellow-100 text-yellow-600">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <span className="shortcut-label">Emergency</span>
                    </button>
                    <button className="shortcut-card" onClick={() => navigate('/parent/settings')}>
                        <div className="shortcut-icon-wrapper bg-gray-100 text-gray-600">
                            <User className="w-6 h-6" />
                        </div>
                        <span className="shortcut-label">Settings</span>
                    </button>
                </div>
            </section>

            {/* Native Ad / Announcement */}
            <section className="native-ad-card shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => navigate('/parent/fees')}>
                <div className="native-ad-badge">Recommended</div>
                <div className="native-ad-content">
                    <div className="native-ad-image-container relative">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-orange-400 to-red-500 flex items-center justify-center text-white shadow-inner">
                            <CreditCard className="w-10 h-10" />
                        </div>
                    </div>
                    <div className="native-ad-text">
                        <h4 className="native-ad-title">Pay Fees Online & Get Rewards!</h4>
                        <p className="native-ad-description">
                            Pay your children's tuition fees before the end of this month to earn Vidyon Points and exclusive school partner vouchers.
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-primary font-bold text-xs">
                            Pay Now <CreditCard className="w-3 h-3" />
                        </div>
                    </div>
                </div>
            </section>

            <AdPlaceholder format="banner" provider="google" slotId="parent-dash-banner-1" className="mb-8" />

            {/* Children Cards */}
            <div id="children-section" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6 mb-8">
                {children.length > 0 ? (
                    children.map((child) => {
                        const childAttendance = childrenAttendance.find(a => a.childId === child.id);
                        return (
                            <div
                                key={child.id}
                                className="bg-card rounded-lg border border-border p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => navigate(`/parent/child/${child.id}`)}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold text-lg">{child.name}</h3>
                                        <p className="text-sm text-muted-foreground">{child.class} - Section {child.section}</p>
                                    </div>
                                    <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                        Roll: {child.rollNumber}
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Attendance:</span>
                                        <span className="font-medium">{childAttendance?.percentage || '0%'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full bg-card rounded-lg border-2 border-dashed p-10 text-center">
                        <User className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-20" />
                        <p className="text-muted-foreground italic">
                            No children linked to this account yet.
                        </p>
                    </div>
                )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <User className="w-5 h-5 text-primary" />
                        <h4 className="font-semibold text-sm">Total Children</h4>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.totalChildren}</p>
                </div>
                <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-5 h-5 text-warning" />
                        <h4 className="font-semibold text-sm">Pending Leave Requests</h4>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.pendingLeaveRequests}</p>
                </div>
                <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <CreditCard className="w-5 h-5 text-destructive" />
                        <h4 className="font-semibold text-sm">Pending Fees</h4>
                    </div>
                    <p className="text-2xl font-bold text-foreground">₹{feeData?.pending || 0}</p>
                </div>
                <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertCircle className="w-5 h-5 text-info" />
                        <h4 className="font-semibold text-sm">Upcoming Events</h4>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stats.upcomingEvents}</p>
                </div>
            </div>

            {/* Special Class Alerts */}
            {specialClasses.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 text-orange-600 flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Special Class Alerts
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {specialClasses.map((slot: any) => {
                            const child = children.find(c => c.classId === slot.class_id);
                            return (
                                <div key={slot.id} className="bg-orange-50/50 border border-orange-100 rounded-lg p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex flex-col items-center justify-center text-orange-600">
                                            <span className="text-[8px] font-bold uppercase">{new Date(slot.event_date).toLocaleString('default', { month: 'short' })}</span>
                                            <span className="text-sm font-bold leading-none">{new Date(slot.event_date).getDate()}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{slot.subjects?.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                For {child?.name || 'Your Child'} ({slot.classes?.name} - {slot.section})
                                            </p>
                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground font-medium">
                                                <Clock className="w-3 h-3" />
                                                {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="bg-white text-orange-600 border-orange-200 text-[10px]">Upcoming</Badge>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Leave Requests */}
            {leaveRequests.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Recent Leave Requests</h2>
                    <div className="space-y-3">
                        {leaveRequests.slice(0, 5).map((request) => (
                            <div key={request.id} className="bg-card rounded-lg border border-border p-4 flex items-center justify-between">
                                <div>
                                    <p className="font-medium">{request.childName}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {request.startDate} to {request.endDate}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">{request.reason}</p>
                                </div>
                                <div className={`px-3 py-1 rounded text-xs font-medium ${request.status === 'approved' ? 'bg-green-100 text-green-700' :
                                    request.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                    }`}>
                                    {request.status.toUpperCase()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Emergency Contacts */}
            <div id="emergency-section">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-destructive" />
                    Emergency Contacts
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card rounded-lg border border-border p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="p-2.5 bg-blue-100 dark:bg-blue-900/20 rounded-full text-blue-600 dark:text-blue-400">
                            <School className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">School Office</p>
                            <a href="tel:+914412345678" className="font-semibold text-foreground hover:text-primary transition-colors block">
                                044-1234 5678
                            </a>
                        </div>
                    </div>
                    <div className="bg-card rounded-lg border border-border p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="p-2.5 bg-red-100 dark:bg-red-900/20 rounded-full text-red-600 dark:text-red-400">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Main Guard</p>
                            <a href="tel:+919876500000" className="font-semibold text-foreground hover:text-primary transition-colors block">
                                +91 98765 00000
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </ParentLayout>
    );
}
