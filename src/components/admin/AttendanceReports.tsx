import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { CalendarIcon, Download, BarChart3, Loader2 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isWithinInterval } from 'date-fns';
import { downloadCSV } from '@/lib/exportUtils';

interface AttendanceSummary {
  user_id: string;
  full_name: string;
  batch_number: string | null;
  unique_id: string | null;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  attendanceRate: number;
  sessionAttendance: number;
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export default function AttendanceReports() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startDate, setStartDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [endDate, setEndDate] = useState<Date>(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const [summaryData, setSummaryData] = useState<AttendanceSummary[]>([]);
  const [batches, setBatches] = useState<string[]>([]);

  useEffect(() => {
    updateDateRange(period, selectedDate);
  }, [period, selectedDate]);

  useEffect(() => {
    fetchReportData();
  }, [user, role, startDate, endDate, batchFilter]);

  const updateDateRange = (reportPeriod: ReportPeriod, date: Date) => {
    switch (reportPeriod) {
      case 'daily':
        setStartDate(date);
        setEndDate(date);
        break;
      case 'weekly':
        setStartDate(startOfWeek(date, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(date, { weekStartsOn: 1 }));
        break;
      case 'monthly':
        setStartDate(startOfMonth(date));
        setEndDate(endOfMonth(date));
        break;
      case 'custom':
        // Keep current custom range
        break;
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Fetch profiles based on role
      let profilesQuery = supabase.from('profiles').select('*').order('full_name');
      
      if (role === 'coach') {
        profilesQuery = profilesQuery.eq('assigned_coach_id', user?.id);
      }

      const [{ data: profilesData }, { data: attendanceData }] = await Promise.all([
        profilesQuery,
        supabase.from('attendance')
          .select('*')
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'))
      ]);

      if (profilesData) {
        // Extract unique batches
        const uniqueBatches = [...new Set(profilesData.map(p => p.batch_number).filter(Boolean))].sort() as string[];
        setBatches(uniqueBatches);

        // Filter by batch if selected
        let filteredProfiles = profilesData;
        if (batchFilter !== 'all') {
          filteredProfiles = profilesData.filter(p => p.batch_number === batchFilter);
        }

        // Calculate total days in period
        const daysInPeriod = eachDayOfInterval({ start: startDate, end: endDate });
        const totalDays = daysInPeriod.length;

        // Calculate summary for each user
        const summary: AttendanceSummary[] = filteredProfiles.map(profile => {
          const userAttendance = (attendanceData || []).filter(a => a.user_id === profile.id);
          const dailyAttendance = userAttendance.filter(a => a.attendance_type === 'daily');
          const sessionAttendance = userAttendance.filter(a => a.attendance_type === 'session');
          
          // Count unique days with daily attendance
          const uniqueDaysPresent = new Set(dailyAttendance.map(a => a.date)).size;
          
          return {
            user_id: profile.id,
            full_name: profile.full_name || 'Unknown',
            batch_number: profile.batch_number,
            unique_id: profile.unique_id,
            totalDays,
            presentDays: uniqueDaysPresent,
            absentDays: totalDays - uniqueDaysPresent,
            attendanceRate: totalDays > 0 ? Math.round((uniqueDaysPresent / totalDays) * 100) : 0,
            sessionAttendance: sessionAttendance.length
          };
        });

        setSummaryData(summary);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (summaryData.length === 0) {
      toast.error(t('admin.noDataToExport'));
      return;
    }

    setExporting(true);
    try {
      const periodLabel = period === 'daily' 
        ? format(startDate, 'yyyy-MM-dd')
        : `${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`;
      
      const headers = {
        full_name: t('admin.participant'),
        unique_id: t('admin.uniqueId'),
        batch_number: t('admin.batch'),
        presentDays: t('admin.daysPresent'),
        absentDays: t('admin.daysAbsent'),
        totalDays: t('admin.totalDays'),
        attendanceRate: t('admin.attendanceRate') + ' (%)',
        sessionAttendance: t('admin.sessionsAttended')
      };

      // Convert to Record<string, unknown>[] for CSV export
      const exportData = summaryData.map(s => ({
        full_name: s.full_name,
        unique_id: s.unique_id || '',
        batch_number: s.batch_number || '',
        presentDays: s.presentDays,
        absentDays: s.absentDays,
        totalDays: s.totalDays,
        attendanceRate: s.attendanceRate,
        sessionAttendance: s.sessionAttendance
      }));
      
      downloadCSV(exportData, `attendance_report_${periodLabel}`, headers);
      toast.success(t('admin.exportSuccess'));
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error(t('common.error'));
    } finally {
      setExporting(false);
    }
  };

  const overallStats = {
    totalParticipants: summaryData.length,
    avgAttendance: summaryData.length > 0 
      ? Math.round(summaryData.reduce((sum, s) => sum + s.attendanceRate, 0) / summaryData.length) 
      : 0,
    totalSessions: summaryData.reduce((sum, s) => sum + s.sessionAttendance, 0)
  };

  const getAttendanceBadge = (rate: number) => {
    if (rate >= 90) return <Badge className="bg-success text-success-foreground">{rate}%</Badge>;
    if (rate >= 70) return <Badge className="bg-warning text-warning-foreground">{rate}%</Badge>;
    return <Badge variant="destructive">{rate}%</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('admin.attendanceReports')}
            </CardTitle>
            <CardDescription>{t('admin.attendanceReportsDesc')}</CardDescription>
          </div>
          <Button onClick={handleExport} disabled={exporting || summaryData.length === 0}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {t('admin.exportCSV')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('admin.reportPeriod')}</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t('admin.daily')}</SelectItem>
                <SelectItem value="weekly">{t('admin.weekly')}</SelectItem>
                <SelectItem value="monthly">{t('admin.monthly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('admin.selectDate')}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('admin.filterByBatch')}</label>
            <Select value={batchFilter} onValueChange={setBatchFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.allBatches')}</SelectItem>
                {batches.map(batch => (
                  <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Period Display */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">
            {t('admin.reportingPeriod')}: {format(startDate, 'PP')} - {format(endDate, 'PP')}
          </p>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{overallStats.totalParticipants}</div>
              <p className="text-sm text-muted-foreground">{t('admin.totalParticipants')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{overallStats.avgAttendance}%</div>
              <p className="text-sm text-muted-foreground">{t('admin.avgAttendanceRate')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{overallStats.totalSessions}</div>
              <p className="text-sm text-muted-foreground">{t('admin.totalSessionAttendances')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
        ) : summaryData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t('admin.noDataFound')}</div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.participant')}</TableHead>
                  <TableHead>{t('admin.uniqueId')}</TableHead>
                  <TableHead>{t('admin.batch')}</TableHead>
                  <TableHead className="text-center">{t('admin.daysPresent')}</TableHead>
                  <TableHead className="text-center">{t('admin.daysAbsent')}</TableHead>
                  <TableHead className="text-center">{t('admin.attendanceRate')}</TableHead>
                  <TableHead className="text-center">{t('admin.sessionsAttended')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryData.map((record) => (
                  <TableRow key={record.user_id}>
                    <TableCell className="font-medium">{record.full_name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {record.unique_id || '-'}
                      </code>
                    </TableCell>
                    <TableCell>
                      {record.batch_number ? (
                        <Badge variant="outline">{record.batch_number}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">{record.presentDays}</TableCell>
                    <TableCell className="text-center">{record.absentDays}</TableCell>
                    <TableCell className="text-center">{getAttendanceBadge(record.attendanceRate)}</TableCell>
                    <TableCell className="text-center">{record.sessionAttendance}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
