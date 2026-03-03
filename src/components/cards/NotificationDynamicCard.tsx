import React, { useState, useEffect } from 'react';
import { Bell, ChevronRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { NotificationPanel } from '@/components/notifications/NotificationPanel';

export function NotificationDynamicCard() {
    const { notifications, loading } = useNotifications();
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (notifications.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % notifications.length);
        }, 1000); // Exactly one notification per second

        return () => clearInterval(interval);
    }, [notifications.length]);

    if (loading) {
        return (
            <Card className="p-6 h-[180px] flex items-center justify-center border-dashed">
                <div className="flex flex-col items-center gap-2 text-muted-foreground animate-pulse">
                    <Bell className="w-8 h-8 opacity-20" />
                    <p className="text-sm font-medium">Syncing notifications...</p>
                </div>
            </Card>
        );
    }

    if (notifications.length === 0) {
        return (
            <Card className="p-6 h-[180px] flex flex-col items-center justify-center text-center bg-muted/5 border-dashed">
                <Bell className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground font-medium">No new notifications</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">We'll notify you when something happens!</p>
            </Card>
        );
    }

    const currentNotification = notifications[currentIndex];

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Card className="relative overflow-hidden cursor-pointer group hover:shadow-md transition-all duration-300 border-l-4 border-l-primary h-[180px] flex flex-col">
                    <div className="p-4 sm:p-5 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-full bg-primary/10 text-primary">
                                    <Bell className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notifications</span>
                            </div>
                            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        </div>

                        <div className="relative flex-1 overflow-hidden">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentNotification.id}
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -20, opacity: 0 }}
                                    transition={{ duration: 0.4, ease: "easeInOut" }}
                                    className="absolute inset-0 flex flex-col justify-center"
                                >
                                    <h4 className="font-bold text-sm sm:text-base text-foreground mb-1 line-clamp-1">
                                        {currentNotification.title}
                                    </h4>
                                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                        {currentNotification.message}
                                    </p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                                            {currentNotification.date}
                                        </span>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <div className="mt-auto pt-3 border-t flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground font-medium">
                                {currentIndex + 1} of {notifications.length} notifications
                            </span>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-primary group-hover:gap-2 transition-all">
                                See All <ChevronRight className="w-3 h-3" />
                            </div>
                        </div>
                    </div>

                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none transform translate-x-4 -translate-y-4">
                        <Bell className="w-24 h-24" />
                    </div>
                </Card>
            </DialogTrigger>
            <DialogContent className="max-w-2xl p-0 overflow-hidden sm:rounded-2xl h-[85vh] flex flex-col">
                <div className="flex-1 min-h-0">
                    <NotificationPanel className="h-full" hideFooter={true} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
