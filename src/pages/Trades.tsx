import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownLeft, Globe, IndianRupee, Upload, Paperclip, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import AuditHistoryPopup from '@/components/shared/AuditHistoryPopup';

interface Trade {
  id: string;
  trade_type: string;
  product_service: string;
  country: string;
  state: string | null;
  amount: number;
  currency: string;
  trade_date: string;
  notes: string | null;
  status: string;
  attachment_url: string | null;
}

const COUNTRIES = [
  'United States', 'United Kingdom', 'Germany', 'France', 'Canada',
  'Australia', 'Japan', 'China', 'Singapore', 'UAE', 'Saudi Arabia',
  'Netherlands', 'Italy', 'Spain', 'South Korea', 'Other'
];

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Trades() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    trade_type: 'export',
    product_service: '',
    country: '',
    state: '',
    amount: '',
    trade_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  useEffect(() => {
    if (user) {
      fetchTrades();
    }
  }, [user]);

  const fetchTrades = async () => {
    try {
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user?.id)
        .order('trade_date', { ascending: false });

      if (data) setTrades(data as Trade[]);
    } catch (error) {
      console.error('Error fetching trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('trades.fileTooLarge'));
        return;
      }
      setAttachmentFile(file);
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadAttachment = async (): Promise<string | null> => {
    if (!attachmentFile || !user) return null;

    setUploadingFile(true);
    try {
      const fileExt = attachmentFile.name.split('.').pop();
      const fileName = `${user.id}/trades/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, attachmentFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(t('trades.uploadFailed'));
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.product_service || !formData.country || !formData.amount) {
      toast.error(t('trades.fillRequired'));
      return;
    }

    // Validate attachment is required
    if (!attachmentFile) {
      toast.error(t('trades.attachmentRequired'));
      return;
    }

    setSubmitting(true);
    try {
      // Upload attachment first
      const attachmentUrl = await uploadAttachment();
      if (!attachmentUrl) {
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from('trades').insert({
        user_id: user.id,
        trade_type: formData.trade_type,
        product_service: formData.product_service,
        country: formData.country,
        state: formData.state || null,
        amount: parseFloat(formData.amount),
        currency: 'INR',
        trade_date: formData.trade_date,
        notes: formData.notes || null,
        status: 'pending',
        attachment_url: attachmentUrl,
      });

      if (error) {
        console.error('Error logging trade:', error);
        toast.error(error.message || t('trades.failedToLog'));
        return;
      }

      toast.success(t('trades.tradeSubmitted'));
      setDialogOpen(false);
      setFormData({
        trade_type: 'export',
        product_service: '',
        country: '',
        state: '',
        amount: '',
        trade_date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
      });
      setAttachmentFile(null);
      fetchTrades();
    } catch (error) {
      console.error('Error logging trade:', error);
      toast.error(t('trades.failedToLog'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success text-success-foreground">{t('trades.approved')}</Badge>;
      case 'pending':
        return <Badge className="bg-warning text-warning-foreground">{t('trades.pendingApproval')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{t('trades.rejected')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Analytics calculations - only count approved trades
  const approvedTrades = trades.filter((t) => t.status === 'approved');
  const totalExports = approvedTrades
    .filter((t) => t.trade_type === 'export')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalImports = approvedTrades
    .filter((t) => t.trade_type === 'import')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalVolume = totalExports + totalImports;

  // Country distribution
  const countryData = approvedTrades.reduce((acc, trade) => {
    const existing = acc.find((c) => c.name === trade.country);
    if (existing) {
      existing.value += Number(trade.amount);
    } else {
      acc.push({ name: trade.country, value: Number(trade.amount) });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  // Trade type data for bar chart
  const tradeTypeData = [
    { name: t('trades.totalExports'), value: totalExports },
    { name: t('trades.totalImports'), value: totalImports },
  ];

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('trades.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('trades.subtitle')}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('trades.logTrade')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('trades.logNewTrade')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div>
                <Label>{t('trades.tradeType')}</Label>
                <Select
                  value={formData.trade_type}
                  onValueChange={(v) => setFormData({ ...formData, trade_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="export">{t('trades.export')}</SelectItem>
                    <SelectItem value="import">{t('trades.import')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('trades.productService')}</Label>
                <Input
                  value={formData.product_service}
                  onChange={(e) =>
                    setFormData({ ...formData, product_service: e.target.value })
                  }
                  placeholder={t('trades.productPlaceholder')}
                  required
                />
              </div>

              <div>
                <Label>{t('trades.country')}</Label>
                <Select
                  value={formData.country}
                  onValueChange={(v) => setFormData({ ...formData, country: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('trades.selectCountry')} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('trades.amount')}</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  placeholder={t('trades.enterAmount')}
                  required
                />
              </div>

              <div>
                <Label>{t('trades.tradeDate')}</Label>
                <Input
                  type="date"
                  value={formData.trade_date}
                  onChange={(e) =>
                    setFormData({ ...formData, trade_date: e.target.value })
                  }
                  required
                />
              </div>

              {/* Mandatory Attachment */}
              <div>
                <Label>
                  {t('trades.supportingDocument')} <span className="text-destructive">*</span>
                </Label>
                <div className="mt-2">
                  {attachmentFile ? (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate">{attachmentFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeAttachment}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {t('trades.uploadDocument')}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('trades.fileTypesHint')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>{t('trades.notes')}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder={t('trades.notesPlaceholder')}
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting || uploadingFile}>
                {(submitting || uploadingFile) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('trades.submitting')}
                  </>
                ) : (
                  t('trades.submitForApproval')
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <IndianRupee className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalVolume)}</p>
                <p className="text-sm text-muted-foreground">{t('trades.approvedVolume')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-success/10">
                <ArrowUpRight className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalExports)}</p>
                <p className="text-sm text-muted-foreground">{t('trades.totalExports')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-warning/10">
                <ArrowDownLeft className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalImports)}</p>
                <p className="text-sm text-muted-foreground">{t('trades.totalImports')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {approvedTrades.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Export vs Import */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">{t('trades.exportVsImport')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tradeTypeData}>
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => formatCurrency(v)} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Country Distribution */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">{t('trades.byCountry')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={countryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name }) => name}
                    >
                      {countryData.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trades Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{t('trades.tradeHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('trades.noTradesYet')}</p>
              <p className="text-sm">{t('trades.clickLogTrade')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('trades.date')}</TableHead>
                    <TableHead>{t('trades.type')}</TableHead>
                    <TableHead>{t('trades.product')}</TableHead>
                    <TableHead>{t('trades.country')}</TableHead>
                    <TableHead className="text-right">{t('trades.amount')}</TableHead>
                    <TableHead>{t('trades.status')}</TableHead>
                    <TableHead>{t('trades.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell>
                        {format(parseISO(trade.trade_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            trade.trade_type === 'export'
                              ? 'border-success text-success'
                              : 'border-warning text-warning'
                          }
                        >
                          {trade.trade_type === 'export' ? (
                            <ArrowUpRight className="h-3 w-3 mr-1" />
                          ) : (
                            <ArrowDownLeft className="h-3 w-3 mr-1" />
                          )}
                          {t(`trades.${trade.trade_type}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>{trade.product_service}</TableCell>
                      <TableCell>{trade.country}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(trade.amount))}
                      </TableCell>
                      <TableCell>{getStatusBadge(trade.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {trade.attachment_url && (
                            <a
                              href={trade.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <Paperclip className="h-4 w-4" />
                            </a>
                          )}
                          <AuditHistoryPopup tableName="trades" recordId={trade.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
