import React, { useState, useEffect } from 'react';
import { LucideIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdCard } from './AdCard';
import { cn } from '@/lib/utils';

interface AdItem {
    title: string;
    description: string;
    badgeText?: string;
    Icon: LucideIcon;
    iconBgColor?: string;
    onClick?: () => void;
}

interface AdCarouselProps {
    ads: AdItem[];
    autoPlayInterval?: number;
    className?: string;
}

export const AdCarousel: React.FC<AdCarouselProps> = ({
    ads,
    autoPlayInterval = 5000,
    className
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (!autoPlayInterval || ads.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % ads.length);
        }, autoPlayInterval);

        return () => clearInterval(interval);
    }, [ads.length, autoPlayInterval]);

    if (ads.length === 0) return null;

    const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % ads.length);
    const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length);

    return (
        <div className={cn("relative group", className)}>
            <div className="overflow-hidden rounded-2xl">
                <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                >
                    {ads.map((ad, index) => (
                        <div key={index} className="w-full flex-shrink-0">
                            <AdCard {...ad} className="mb-0 border-none shadow-none rounded-none" />
                        </div>
                    ))}
                </div>
            </div>

            {ads.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 shadow-sm border border-border flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-primary z-10"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={nextSlide}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 shadow-sm border border-border flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-primary z-10"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </>
            )}
        </div>
    );
};
