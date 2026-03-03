import {
    FileText,
    Calendar,
    Clock,
    Megaphone,
    BarChart,
    CreditCard,
    CheckCircle,
    AlertTriangle,
    Info,
    XCircle,
    Bell,
    Loader2,
    ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotifications, NotificationType } from '@/hooks/useNotifications';

const TypeIcon = ({ type }: { type: NotificationType }) => {
    switch (type) {
        case 'assignment': return <FileText className="w-5 h-5 text-blue-500" />;
        case 'attendance': return <Clock className="w-5 h-5 text-red-500" />;
        case 'leave': return <CheckCircle className="w-5 h-5 text-green-500" />;
        case 'announcement': return <Megaphone className="w-5 h-5 text-purple-500" />;
        case 'exam': return <BarChart className="w-5 h-5 text-orange-500" />;
        case 'fees': return <CreditCard className="w-5 h-5 text-yellow-500" />;
        case 'event': return <Calendar className="w-5 h-5 text-indigo-500" />;
        case 'timetable': return <Calendar className="w-5 h-5 text-teal-500" />;
        default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
};

export function NotificationPanel({ className, hideFooter = false }: { className?: string, hideFooter?: boolean }) {
    const { notifications, loading } = useNotifications();
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className="flex items-center justify-between p-4 sm:p-6 border-b">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notifications
                </h3>
                <Badge variant="warning">
                    {notifications.filter(n => !n.read).length} New
                </Badge>
            </div>

            <ScrollArea className="flex-1 min-h-0">
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <Bell className="w-8 h-8 mb-2 opacity-20" />
                        <p>No notifications</p>
                    </div>
                ) : (
                    <div className="p-4 sm:p-6 space-y-4">
                        {notifications.map((notification) => (
                            <Card
                                key={notification.id}
                                onClick={() => {
                                    if (user?.role !== 'parent' && notification.actionUrl) {
                                        navigate(notification.actionUrl);
                                    }
                                }}
                                className={cn(
                                    "p-3 sm:p-4 transition-all border-l-4 touch-active",
                                    user?.role !== 'parent' && "hover:bg-muted/50 cursor-pointer",
                                    user?.role === 'parent' && "cursor-default",
                                    notification.read ? "border-l-transparent" : "border-l-primary bg-primary/5"
                                )}
                            >
                                <div className="flex gap-4">
                                    <div className={cn(
                                        "p-2 rounded-full h-fit",
                                        "bg-background border shadow-sm"
                                    )}>
                                        <TypeIcon type={notification.type} />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className={cn("text-sm font-semibold", !notification.read && "text-foreground")}>
                                                {notification.title}
                                            </h4>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {notification.date}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {notification.message}
                                        </p>

                                        {/* Action Button - Hidden for Parents as per request */}
                                        {notification.actionUrl && user?.role !== 'parent' && (
                                            <div className="mt-3">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-7 text-[10px] gap-1.5 px-2"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(notification.actionUrl!);
                                                    }}
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    View Details
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </ScrollArea>

            {!hideFooter && (
                <div className="p-4 border-t bg-muted/20 text-center">
                    <button className="text-sm text-primary hover:underline">
                        Mark all as read
                    </button>
                </div>
            )}
        </div>
    );
}
