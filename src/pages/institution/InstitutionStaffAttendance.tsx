import { InstitutionLayout } from '@/layouts/InstitutionLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import { Calendar, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdCard } from '@/components/cards/AdCard';

const SECRET_KEY = import.meta.env.VITE_QR_SECRET || 'myvidyon-qr-secret-fallback'; // Use env variable for production

export function InstitutionStaffAttendance() {
    const { user } = useAuth();
    const [qrData, setQrData] = useState<string>('');
    const [currentDate, setCurrentDate] = useState<string>('');

    const generateQRCode = () => {
        if (!user?.institutionId) return;

        const date = new Date().toISOString().split('T')[0];
        const timestamp = Date.now();
        const payload = {
            institutionId: user.institutionId,
            date: date,
            timestamp: timestamp, // Added for dynamic refresh
            signature: CryptoJS.SHA256(user.institutionId + date + timestamp + SECRET_KEY).toString(),
        };

        setQrData(JSON.stringify(payload));
        setCurrentDate(date);
    };

    useEffect(() => {
        generateQRCode();
        // Refresh every hour to ensure date change is captured
        const interval = setInterval(generateQRCode, 3600000);
        return () => clearInterval(interval);
    }, [user?.institutionId]);

    return (
        <InstitutionLayout>
            <PageHeader
                title="Staff Attendance QR"
                subtitle="Display this QR code for faculty members to scan for their daily attendance"
            />

            <AdCard
                title="Boost Staff Morale with Rewards"
                description="Our new 'Teacher of the Month' widget is now available for your digital entrance boards. Increase engagement and retention."
                Icon={Sparkles}
                iconBgColor="bg-gradient-to-tr from-amber-400 to-orange-600 text-white"
                badgeText="New Feature"
                variant="compact"
                className="mb-8"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="dashboard-card flex flex-col items-center justify-center p-8 text-center">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border mb-6">
                        {qrData ? (
                            <QRCodeSVG value={qrData} size={256} level="H" includeMargin={true} />
                        ) : (
                            <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg animate-pulse">
                                <RefreshCw className="w-12 h-12 text-muted-foreground animate-spin" />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-institution">Daily Entrance QR</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            This QR code is valid only for today and for your institution staff members.
                        </p>
                    </div>

                    <Button
                        onClick={generateQRCode}
                        variant="outline"
                        className="mt-8 flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh QR Code
                    </Button>
                </div>

                <div className="space-y-6">
                    <div className="dashboard-card p-6 border-l-4 border-l-institution">
                        <div className="flex items-start gap-4">
                            <div className="bg-institution/10 p-3 rounded-lg">
                                <Calendar className="w-6 h-6 text-institution" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-institution">Today's Session</h4>
                                <p className="text-2xl font-bold mt-1">
                                    {new Date().toLocaleDateString('en-IN', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Attendance will be recorded for the current date.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="dashboard-card p-6 border-l-4 border-l-success">
                        <div className="flex items-start gap-4">
                            <div className="bg-success/10 p-3 rounded-lg">
                                <ShieldCheck className="w-6 h-6 text-success" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-success">Security Information</h4>
                                <p className="text-sm text-muted-foreground mt-2">
                                    The QR code contains a secure cryptographic signature. It cannot be spoofed or reused for other days or other institutions.
                                </p>
                                <ul className="text-xs text-muted-foreground mt-4 space-y-1 list-disc list-inside">
                                    <li>Valid for 24 hours (current date)</li>
                                    <li>Institution bound</li>
                                    <li>One-time registration per staff member per day</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="bg-muted/50 p-6 rounded-xl border border-dashed border-muted-foreground/30">
                        <h4 className="font-medium text-sm mb-2 text-muted-foreground uppercase tracking-wider">How to use</h4>
                        <ol className="text-sm space-y-3 text-muted-foreground">
                            <li className="flex gap-3">
                                <span className="bg-institution/20 text-institution w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                                <span>Open this page on a tablet or screen at the entrance.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-institution/20 text-institution w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                                <span>Ask faculty members to scan this QR using the "Self Attendance" feature in their dashboard.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-institution/20 text-institution w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                                <span>Verification happens instantly and attendance is logged to the database.</span>
                            </li>
                        </ol>
                    </div>
                </div>
            </div>
        </InstitutionLayout>
    );
}
