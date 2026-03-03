import React from 'react';
import { ParentLayout } from '@/layouts/ParentLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/ui/button';
import { IndianRupee, CreditCard, CheckCircle, Receipt, Download, ShieldCheck, Award } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/TranslationContext';
import { useAuth } from '@/context/AuthContext';
import { useParentDashboard } from '@/hooks/useParentDashboard';
import { supabase } from '@/lib/supabase';
import { InvoiceView } from '@/components/common/InvoiceView';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdCard } from '@/components/cards/AdCard';

export function ParentFees() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { feeData, feeRecords, isLoading } = useParentDashboard(user?.id, user?.institutionId);
    const [selectedBill, setSelectedBill] = React.useState<any>(null);
    const [isInvoiceOpen, setIsInvoiceOpen] = React.useState(false);
    const [isPaying, setIsPaying] = React.useState<string | null>(null);
    const queryClient = useQueryClient();

    const { data: institutionInfo } = useQuery({
        queryKey: ['institution-branding', user?.institutionId],
        queryFn: async () => {
            if (!user?.institutionId) return null;
            const { data, error } = await supabase
                .from('institutions')
                .select('*')
                .eq('institution_id', user.institutionId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.institutionId,
    });

    const handleViewReceipt = (bill: any) => {
        // Map student fee record to InvoiceView requirements
        const studentObj = {
            name: bill.students?.name || 'Student',
            rollNo: 'N/A',
            address: bill.students?.address,
            fees: {
                total: bill.amount_due,
                paid: bill.amount_paid,
                pending: bill.amount_due - bill.amount_paid,
                structure: []
            }
        };

        // If it's a manual bill, parse components
        try {
            const desc = JSON.parse(bill.description);
            if (Array.isArray(desc)) {
                studentObj.fees.structure = desc.map(d => ({
                    category: d.title,
                    amount: parseFloat(d.amount),
                    paid: bill.status === 'paid' ? parseFloat(d.amount) : 0
                }));
            }
        } catch (e) {
            studentObj.fees.structure = [{
                category: bill.description || 'General Fee',
                amount: bill.amount_due,
                paid: bill.amount_paid
            }];
        }

        setSelectedBill({
            student: studentObj,
            classInfo: {
                className: bill.students?.class_name || 'N/A',
                section: bill.students?.section || 'N/A'
            }
        });
        setIsInvoiceOpen(true);
    };

    const handleDownloadReceipt = () => {
        toast.success(t.parent.fees.downloadingReceipt);
        setTimeout(() => {
            window.print();
        }, 500);
    };

    const handlePayNow = async (bill: any) => {
        try {
            setIsPaying(bill.id);
            toast.loading(t.parent.fees.processingPayment || 'Processing simulation...', { id: 'payment-loading' });

            // SIMULATED PAYMENT: Update database directly
            const { error } = await supabase
                .from('student_fees')
                .update({
                    status: 'paid',
                    amount_paid: bill.amount_due
                })
                .eq('id', bill.id);

            if (error) throw error;

            toast.success(t.parent.fees.paymentSuccess || 'Payment simulated successfully!', { id: 'payment-loading' });

            // Invalidate queries to refresh UI
            queryClient.invalidateQueries({ queryKey: ['parent-fee-records'] });
            queryClient.invalidateQueries({ queryKey: ['parent-fee-summary'] });

        } catch (error: any) {
            console.error('[PAYMENT] Simulation failed:', error);
            toast.error('Payment simulation failed: ' + error.message, { id: 'payment-loading' });
        } finally {
            setIsPaying(null);
        }
    };

    if (isLoading) {
        return (
            <ParentLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </ParentLayout>
        );
    }

    return (
        <>
            <ParentLayout>
                <PageHeader
                    title={t.parent.fees.title}
                    subtitle={t.parent.fees.subtitle}
                />

                <AdCard
                    title="Protect Your Family's Education"
                    description="Get comprehensive education insurance coverage for your children at exclusive partner rates."
                    Icon={ShieldCheck}
                    iconBgColor="bg-gradient-to-tr from-blue-500 to-indigo-600 text-white"
                    badgeText="Financial Security"
                    variant="compact"
                    className="mb-6"
                />

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                    <div className="p-4 sm:p-6 rounded-xl bg-white border border-border shadow-sm">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="p-2 sm:p-3 rounded-full bg-primary/10 text-primary flex-shrink-0">
                                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-muted-foreground truncate">{t.parent.fees.totalDue}</p>
                                <h3 className="text-xl sm:text-2xl font-bold">₹ {(feeData?.pending || 0).toLocaleString()}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 sm:p-6 rounded-xl bg-white border border-border shadow-sm">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="p-2 sm:p-3 rounded-full bg-success/10 text-success flex-shrink-0">
                                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-muted-foreground truncate">{t.parent.fees.paidThisYear}</p>
                                <h3 className="text-xl sm:text-2xl font-bold">₹ {(feeData?.paid || 0).toLocaleString()}</h3>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fee Records Table */}
                <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-border">
                        <h3 className="font-semibold text-base sm:text-lg">{t.parent.fees.feeRecords}</h3>
                    </div>

                    {/* Mobile Card View */}
                    <div className="block lg:hidden">
                        {feeRecords.length > 0 ? (
                            feeRecords.map((item: any) => {
                                let feeType = 'Tuition Fee';
                                try {
                                    const desc = JSON.parse(item.description);
                                    if (Array.isArray(desc) && desc.length > 0) {
                                        feeType = desc.map(d => d.title).join(', ');
                                    }
                                } catch (e) {
                                    feeType = item.description || 'General Fee';
                                }

                                return (
                                    <div key={item.id} className="p-4 border-b border-border hover:bg-muted/30 transition-colors">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-sm mb-1 truncate">{item.students?.name || 'N/A'}</p>
                                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{feeType}</p>
                                            </div>
                                            <Badge
                                                variant={item.status === 'paid' ? 'success' : item.status === 'partial' ? 'warning' : 'destructive'}
                                                className="capitalize ml-2 flex-shrink-0"
                                            >
                                                {item.status}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between items-center mb-3">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Amount</p>
                                                <p className="font-bold text-base">₹ {item.amount_due.toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">Due Date</p>
                                                <p className="text-sm">{item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A'}</p>
                                            </div>
                                        </div>
                                        {item.status === 'paid' ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleViewReceipt(item)}
                                                className="w-full min-h-[44px] flex items-center justify-center gap-2"
                                            >
                                                <Download className="w-4 h-4" />
                                                {t.parent.fees.receipt}
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                disabled={isPaying === item.id}
                                                onClick={() => handlePayNow(item)}
                                                className="w-full min-h-[44px] bg-primary text-white"
                                            >
                                                {isPaying === item.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                        {t.parent.fees.processing || 'Processing...'}
                                                    </div>
                                                ) : (
                                                    t.parent.fees.payNow
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-8 text-center text-muted-foreground italic">
                                No fee records found.
                            </div>
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border">
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">{t.parent.fees.student}</th>
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">{t.parent.fees.feeType}</th>
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">{t.parent.fees.amount}</th>
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">{t.parent.fees.dueDate}</th>
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">{t.parent.fees.status}</th>
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">{t.parent.fees.action}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feeRecords.length > 0 ? (
                                    feeRecords.map((item: any) => {
                                        let feeType = 'Tuition Fee';
                                        try {
                                            const desc = JSON.parse(item.description);
                                            if (Array.isArray(desc) && desc.length > 0) {
                                                feeType = desc.map(d => d.title).join(', ');
                                            }
                                        } catch (e) {
                                            feeType = item.description || 'General Fee';
                                        }

                                        return (
                                            <tr key={item.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                                                <td className="py-3 px-4 text-sm font-medium">{item.students?.name || 'N/A'}</td>
                                                <td className="py-3 px-4 text-sm max-w-[200px] truncate">{feeType}</td>
                                                <td className="py-3 px-4 text-sm font-semibold">₹ {item.amount_due.toLocaleString()}</td>
                                                <td className="py-3 px-4 text-sm text-muted-foreground">
                                                    {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge
                                                        variant={item.status === 'paid' ? 'success' : item.status === 'partial' ? 'warning' : 'destructive'}
                                                        className="capitalize"
                                                    >
                                                        {item.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {item.status === 'paid' ? (
                                                        <Button variant="ghost" size="sm" onClick={() => handleViewReceipt(item)}>
                                                            <Download className="w-4 h-4 mr-2" />
                                                            {t.parent.fees.receipt}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            disabled={isPaying === item.id}
                                                            onClick={() => handlePayNow(item)}
                                                            className="bg-primary text-white"
                                                        >
                                                            {isPaying === item.id ? (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                                    {t.parent.fees.processing || 'Processing...'}
                                                                </div>
                                                            ) : (
                                                                t.parent.fees.payNow
                                                            )}
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="py-10 text-center text-muted-foreground italic">
                                            No fee records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </ParentLayout>

            <Dialog open={isInvoiceOpen} onOpenChange={setIsInvoiceOpen}>
                <DialogContent className="!fixed !inset-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none lg:!max-w-4xl xl:!max-w-5xl lg:!h-auto lg:!inset-auto lg:!w-auto lg:!left-[50%] lg:!top-[50%] lg:!-translate-x-1/2 lg:!-translate-y-1/2 lg:!rounded-2xl bg-white text-black p-0 overflow-hidden border-none shadow-2xl">
                    {selectedBill && (
                        <InvoiceView
                            student={selectedBill.student}
                            institution={{
                                name: institutionInfo?.name || 'VidyOn Institution',
                                logo_url: institutionInfo?.logo_url,
                                address: institutionInfo?.address,
                                city: institutionInfo?.city,
                                email: institutionInfo?.email,
                                phone: institutionInfo?.phone
                            }}
                            classInfo={selectedBill.classInfo}
                            onClose={() => setIsInvoiceOpen(false)}
                            isParentView={true}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
