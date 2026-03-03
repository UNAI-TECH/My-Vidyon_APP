import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdCardProps {
    title: string;
    description: string;
    badgeText?: string;
    Icon: LucideIcon;
    iconBgColor?: string;
    onClick?: () => void;
    className?: string;
    variant?: 'default' | 'compact';
}

export const AdCard: React.FC<AdCardProps> = ({
    title,
    description,
    badgeText = "Sponsored",
    Icon,
    iconBgColor = "bg-primary/10",
    onClick,
    className,
    variant = 'default'
}) => {
    if (variant === 'compact') {
        return (
            <div
                className={cn(
                    "relative overflow-hidden rounded-xl bg-white border border-border shadow-sm p-3 group cursor-pointer transition-all hover:shadow-md hover:border-primary/30",
                    className
                )}
                onClick={onClick}
            >
                <div className="absolute top-2 right-2 text-[6px] font-bold uppercase tracking-widest text-muted-foreground/60">{badgeText}</div>
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center text-primary group-hover:scale-105 transition-transform duration-300",
                        iconBgColor
                    )}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{title}</h4>
                        <p className="text-[10px] text-muted-foreground truncate">{description}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <section
            className={cn(
                "native-ad-card cursor-pointer group",
                className
            )}
            onClick={onClick}
        >
            <div className="native-ad-badge">{badgeText}</div>

            {/* Subtle decorative background element */}
            <div className="absolute -bottom-4 -right-4 w-24 h-24 deco-dots text-primary/5 group-hover:text-primary/10 transition-colors pointer-events-none" />

            <div className="native-ad-content">
                <div className="relative flex-shrink-0">
                    <div className={cn(
                        "w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-primary shadow-sm border border-border/50 group-hover:scale-105 transition-transform duration-300",
                        iconBgColor
                    )}>
                        <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
                    </div>
                </div>

                <div className="native-ad-text">
                    <h4 className="native-ad-title group-hover:text-primary transition-colors">{title}</h4>
                    <p className="native-ad-description">
                        {description}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-primary/70 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                        Learn More <span className="text-lg leading-none">›</span>
                    </div>
                </div>
            </div>
        </section>
    );
};
