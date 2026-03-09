import React, { useEffect, useRef } from 'react';
import { Megaphone } from 'lucide-react';

interface AdPlaceholderProps {
    className?: string;
    format?: 'banner' | 'rectangle' | 'square' | 'fluid';
    provider?: 'google' | 'meta' | 'custom';
    slotId?: string;
}

export function AdPlaceholder({
    className = '',
    format = 'banner',
    provider = 'google',
    slotId
}: AdPlaceholderProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Future integration point for actual Google AdSense or Meta Ads script
    useEffect(() => {
        if (provider === 'google' && slotId) {
            // (window as any).adsbygoogle = (window as any).adsbygoogle || [];
            // (window as any).adsbygoogle.push({});
        }
    }, [provider, slotId]);

    const baseStyles = 'relative flex items-center justify-center bg-muted/20 border border-dashed border-muted-foreground/30 rounded-lg overflow-hidden transition-all hover:bg-muted/30';

    const formatStyles = {
        banner: 'w-full min-h-[90px] md:min-h-[120px]',
        rectangle: 'w-full min-h-[250px] max-w-[300px] mx-auto',
        square: 'w-full aspect-square max-w-[250px] mx-auto',
        fluid: 'w-full h-full min-h-[100px]',
    };

    return (
        <div
            ref={containerRef}
            className={`${baseStyles} ${formatStyles[format]} ${className}`}
            data-ad-provider={provider}
            data-ad-slot={slotId}
            aria-label="Advertisement Space"
        >
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center opacity-70">
                <Megaphone className="w-6 h-6 mb-2 text-muted-foreground" />
                <p className="text-sm font-semibold text-muted-foreground">Advertisement Space</p>
                <p className="text-[10px] text-muted-foreground/80 mt-1 uppercase tracking-wider">
                    {provider === 'google' ? 'Google Ads Ready' :
                        provider === 'meta' ? 'Meta Ads Ready' :
                            'Ad Space Available'}
                </p>
                {slotId && <p className="text-[8px] text-muted-foreground/50 mt-1 font-mono">Slot: {slotId}</p>}
            </div>
        </div>
    );
}
