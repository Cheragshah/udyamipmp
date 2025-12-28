import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DateRangeFilter } from './DateRangeFilter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileBarChart, Loader2 } from 'lucide-react';
import { downloadCSV } from '@/lib/exportUtils';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type DataSource = 'profiles' | 'task_submissions' | 'documents' | 'trades' | 'attendance' | 'participant_progress' | 'ecommerce_setups';
type ReportType = 'table' | 'bar' | 'pie';

interface FieldOption {
  key: string;
  label: string;
  selected: boolean;
}

const DATA_SOURCE_FIELDS: Record<DataSource, FieldOption[]> = {
  profiles: [
    { key: 'full_name', label: 'Name', selected: true },
    { key: 'email', label: 'Email', selected: true },
    { key: 'batch_number', label: 'Batch', selected: true },
    { key: 'phone', label: 'Phone', selected: false },
    { key: 'created_at', label: 'Joined Date', selected: false },
  ],
  task_submissions: [
    { key: 'user_name', label: 'Participant', selected: true },
    { key: 'task_title', label: 'Task', selected: true },
    { key: 'status', label: 'Status', selected: true },
    { key: 'submitted_at', label: 'Submitted', selected: true },
    { key: 'verified_at', label: 'Verified', selected: false },
  ],
  documents: [
    { key: 'user_name', label: 'Participant', selected: true },
    { key: 'document_type', label: 'Type', selected: true },
    { key: 'document_name', label: 'Name', selected: true },
    { key: 'status', label: 'Status', selected: true },
    { key: 'submitted_at', label: 'Submitted', selected: false },
  ],
  trades: [
    { key: 'user_name', label: 'Participant', selected: true },
    { key: 'trade_type', label: 'Type', selected: true },
    { key: 'product_service', label: 'Product/Service', selected: true },
    { key: 'amount', label: 'Amount', selected: true },
    { key: 'country', label: 'Country', selected: true },
    { key: 'status', label: 'Status', selected: true },
    { key: 'trade_date', label: 'Date', selected: false },
  ],
  attendance: [
    { key: 'user_name', label: 'Participant', selected: true },
    { key: 'date', label: 'Date', selected: true },
    { key: 'attendance_type', label: 'Type', selected: true },
    { key: 'session_name', label: 'Session', selected: false },
    { key: 'check_in_time', label: 'Check-in', selected: false },
  ],
  participant_progress: [
    { key: 'user_name', label: 'Participant', selected: true },
    { key: 'stage_name', label: 'Stage', selected: true },
    { key: 'status', label: 'Status', selected: true },
    { key: 'started_at', label: 'Started', selected: false },
    { key: 'completed_at', label: 'Completed', selected: false },
  ],
  ecommerce_setups: [
    { key: 'user_name', label: 'Participant', selected: true },
    { key: 'store_name', label: 'Store', selected: true },
    { key: 'platform', label: 'Platform', selected: true },
    { key: 'status', label: 'Status', selected: true },
    { key: 'created_at', label: 'Created', selected: false },
  ],
};

const COLORS = ['hsl(var(--primary))', '#22c55e', '#3b82f6', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4'];

export const CustomReportBuilder = () => {
  const { t } = useTranslation();
  const [dataSource, setDataSource] = useState<DataSource>('profiles');
  const [fields, setFields] = useState<FieldOption[]>(DATA_SOURCE_FIELDS.profiles);
  const [reportType, setReportType] = useState<ReportType>('table');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    setFields(DATA_SOURCE_FIELDS[dataSource].map(f => ({ ...f })));
    setShowReport(false);
    setReportData([]);
  }, [dataSource]);

  const fetchBatches = async () => {
    const { data } = await supabase.from('profiles').select('batch_number').not('batch_number', 'is', null);
    const uniqueBatches = [...new Set((data || []).map(p => p.batch_number).filter(Boolean))] as string[];
    setBatches(uniqueBatches);
  };

  const toggleField = (key: string) => {
    setFields(fields.map(f => f.key === key ? { ...f, selected: !f.selected } : f));
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      let data: any[] = [];
      const profiles = await supabase.from('profiles').select('id, full_name, email, batch_number');
      const profileMap = new Map((profiles.data || []).map(p => [p.id, p]));

      switch (dataSource) {
        case 'profiles': {
          let query = supabase.from('profiles').select('*');
          if (batchFilter !== 'all') query = query.eq('batch_number', batchFilter);
          const { data: profilesData } = await query;
          data = profilesData || [];
          break;
        }
        case 'task_submissions': {
          const { data: tasks } = await supabase.from('tasks').select('id, title');
          const taskMap = new Map((tasks || []).map(t => [t.id, t.title]));
          
          let query = supabase.from('task_submissions').select('*');
          if (statusFilter !== 'all') query = query.eq('status', statusFilter);
          if (startDate) query = query.gte('submitted_at', startDate.toISOString());
          if (endDate) query = query.lte('submitted_at', endDate.toISOString());
          
          const { data: submissions } = await query;
          data = (submissions || []).map(s => ({
            ...s,
            user_name: profileMap.get(s.user_id)?.full_name || 'Unknown',
            task_title: taskMap.get(s.task_id) || 'Unknown',
          })).filter(s => batchFilter === 'all' || profileMap.get(s.user_id)?.batch_number === batchFilter);
          break;
        }
        case 'documents': {
          let query = supabase.from('documents').select('*');
          if (statusFilter !== 'all') query = query.eq('status', statusFilter);
          if (startDate) query = query.gte('submitted_at', startDate.toISOString());
          if (endDate) query = query.lte('submitted_at', endDate.toISOString());
          
          const { data: docs } = await query;
          data = (docs || []).map(d => ({
            ...d,
            user_name: profileMap.get(d.user_id)?.full_name || 'Unknown',
          })).filter(d => batchFilter === 'all' || profileMap.get(d.user_id)?.batch_number === batchFilter);
          break;
        }
        case 'trades': {
          let query = supabase.from('trades').select('*');
          if (statusFilter !== 'all') query = query.eq('status', statusFilter);
          if (startDate) query = query.gte('trade_date', startDate.toISOString().split('T')[0]);
          if (endDate) query = query.lte('trade_date', endDate.toISOString().split('T')[0]);
          
          const { data: trades } = await query;
          data = (trades || []).map(t => ({
            ...t,
            user_name: profileMap.get(t.user_id)?.full_name || 'Unknown',
          })).filter(t => batchFilter === 'all' || profileMap.get(t.user_id)?.batch_number === batchFilter);
          break;
        }
        case 'attendance': {
          let query = supabase.from('attendance').select('*');
          if (startDate) query = query.gte('date', startDate.toISOString().split('T')[0]);
          if (endDate) query = query.lte('date', endDate.toISOString().split('T')[0]);
          
          const { data: attendance } = await query;
          data = (attendance || []).map(a => ({
            ...a,
            user_name: profileMap.get(a.user_id)?.full_name || 'Unknown',
          })).filter(a => batchFilter === 'all' || profileMap.get(a.user_id)?.batch_number === batchFilter);
          break;
        }
        case 'participant_progress': {
          const { data: stages } = await supabase.from('journey_stages').select('id, name');
          const stageMap = new Map((stages || []).map(s => [s.id, s.name]));
          
          let query = supabase.from('participant_progress').select('*');
          if (statusFilter !== 'all') query = query.eq('status', statusFilter);
          if (startDate) query = query.gte('completed_at', startDate.toISOString());
          if (endDate) query = query.lte('completed_at', endDate.toISOString());
          
          const { data: progress } = await query;
          data = (progress || []).map(p => ({
            ...p,
            user_name: profileMap.get(p.user_id)?.full_name || 'Unknown',
            stage_name: stageMap.get(p.stage_id) || 'Unknown',
          })).filter(p => batchFilter === 'all' || profileMap.get(p.user_id)?.batch_number === batchFilter);
          break;
        }
        case 'ecommerce_setups': {
          let query = supabase.from('ecommerce_setups').select('*');
          if (statusFilter !== 'all') query = query.eq('status', statusFilter);
          if (startDate) query = query.gte('created_at', startDate.toISOString());
          if (endDate) query = query.lte('created_at', endDate.toISOString());
          
          const { data: setups } = await query;
          data = (setups || []).map(s => ({
            ...s,
            user_name: profileMap.get(s.user_id)?.full_name || 'Unknown',
          })).filter(s => batchFilter === 'all' || profileMap.get(s.user_id)?.batch_number === batchFilter);
          break;
        }
      }

      setReportData(data);
      setShowReport(true);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    const selectedFields = fields.filter(f => f.selected);
    const headers: Record<string, string> = {};
    selectedFields.forEach(f => { headers[f.key] = f.label; });
    
    const exportData = reportData.map(row => {
      const filtered: Record<string, any> = {};
      selectedFields.forEach(f => { filtered[f.key] = row[f.key]; });
      return filtered;
    });
    
    downloadCSV(exportData, `custom_report_${dataSource}`, headers);
    toast.success(t('common.exportSuccess'));
  };

  const getChartData = () => {
    const statusField = fields.find(f => f.key === 'status');
    if (!statusField) return [];
    
    const counts: Record<string, number> = {};
    reportData.forEach(row => {
      const status = row.status || 'unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    
    return Object.entries(counts).map(([name, value]) => ({ name: t(`status.${name}`, name), value }));
  };

  const selectedFields = fields.filter(f => f.selected);

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5" />
            {t('reports.customReportBuilder')}
          </CardTitle>
          <CardDescription>{t('reports.customReportBuilderDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Data Source */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('reports.selectDataSource')}</Label>
            <Select value={dataSource} onValueChange={(v) => setDataSource(v as DataSource)}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="profiles">{t('reports.dataSources.profiles')}</SelectItem>
                <SelectItem value="task_submissions">{t('reports.dataSources.taskSubmissions')}</SelectItem>
                <SelectItem value="documents">{t('reports.dataSources.documents')}</SelectItem>
                <SelectItem value="trades">{t('reports.dataSources.trades')}</SelectItem>
                <SelectItem value="attendance">{t('reports.dataSources.attendance')}</SelectItem>
                <SelectItem value="participant_progress">{t('reports.dataSources.participantProgress')}</SelectItem>
                <SelectItem value="ecommerce_setups">{t('reports.dataSources.ecommerceSetups')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Select Fields */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('reports.selectFields')}</Label>
            <div className="flex flex-wrap gap-3">
              {fields.map(field => (
                <div key={field.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={field.key}
                    checked={field.selected}
                    onCheckedChange={() => toggleField(field.key)}
                  />
                  <label htmlFor={field.key} className="text-sm cursor-pointer">
                    {field.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Filters */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('reports.filters')}</Label>
            <div className="flex flex-wrap gap-4 items-end">
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onClear={() => { setStartDate(undefined); setEndDate(undefined); }}
              />
              
              {dataSource !== 'profiles' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder={t('reports.status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('reports.allStatuses')}</SelectItem>
                    <SelectItem value="completed">{t('status.completed')}</SelectItem>
                    <SelectItem value="in_progress">{t('status.in_progress')}</SelectItem>
                    <SelectItem value="pending">{t('status.pending')}</SelectItem>
                    <SelectItem value="verified">{t('status.verified')}</SelectItem>
                    <SelectItem value="submitted">{t('status.submitted')}</SelectItem>
                    <SelectItem value="approved">{t('status.approved')}</SelectItem>
                    <SelectItem value="rejected">{t('status.rejected')}</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t('reports.batch')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('finance.allBatches')}</SelectItem>
                  {batches.map(batch => (
                    <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Step 4: Report Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('reports.reportType')}</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">{t('reports.reportTypes.table')}</SelectItem>
                <SelectItem value="bar">{t('reports.reportTypes.bar')}</SelectItem>
                <SelectItem value="pie">{t('reports.reportTypes.pie')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <div className="flex gap-2">
            <Button onClick={generateReport} disabled={loading || selectedFields.length === 0}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('reports.generateReport')}
            </Button>
            {showReport && reportData.length > 0 && (
              <Button variant="outline" onClick={exportReport}>
                <Download className="h-4 w-4 mr-2" />
                {t('common.exportCSV')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Output */}
      {showReport && (
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.reportResults')}</CardTitle>
            <CardDescription>
              {t('reports.showingRecords', { count: reportData.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reportData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('common.noData')}
              </div>
            ) : reportType === 'table' ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectedFields.map(f => (
                        <TableHead key={f.key}>{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.slice(0, 100).map((row, idx) => (
                      <TableRow key={idx}>
                        {selectedFields.map(f => (
                          <TableCell key={f.key}>
                            {f.key === 'status' ? (
                              <Badge variant={row[f.key] === 'completed' || row[f.key] === 'verified' || row[f.key] === 'approved' ? 'default' : 'secondary'}>
                                {String(t(`status.${row[f.key]}`, row[f.key]))}
                              </Badge>
                            ) : f.key === 'batch_number' && row[f.key] ? (
                              <Badge variant="outline">{row[f.key]}</Badge>
                            ) : f.key === 'amount' ? (
                              `₹${Number(row[f.key]).toLocaleString()}`
                            ) : row[f.key] instanceof Date ? (
                              new Date(row[f.key]).toLocaleDateString()
                            ) : typeof row[f.key] === 'string' && row[f.key]?.includes('T') ? (
                              new Date(row[f.key]).toLocaleDateString()
                            ) : (
                              row[f.key] || '-'
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {reportData.length > 100 && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    {String(t('reports.showingFirst100'))}
                  </p>
                )}
              </div>
            ) : reportType === 'pie' ? (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getChartData()}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {getChartData().map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))">
                      {getChartData().map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
