import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { DollarSign, Search, Loader2, CreditCard, BarChart3, Users, CheckCircle, Clock, TrendingUp, Percent, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { downloadCSV } from '@/lib/exportUtils';
import { AnalyticsDetailDialog, DrillDownRecord } from '@/components/analytics/AnalyticsDetailDialog';
import { format } from 'date-fns';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  batch_number?: string | null;
}

interface ParticipantProgress {
  id: string;
  user_id: string;
  stage_id: string;
  status: string;
  completed_at: string | null;
}

interface JourneyStage {
  id: string;
  name: string;
  stage_order: number;
  description: string | null;
}

// Define financial milestones - only fee-related stage for finance team
const FINANCIAL_STAGES = [
  { order: 2, name: 'Fees Paid', icon: CreditCard, editable: true },
];

const Finance = () => {
  const { t, i18n } = useTranslation();
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [progress, setProgress] = useState<ParticipantProgress[]>([]);
  const [stages, setStages] = useState<JourneyStage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<number>(2);
  
  // Drill-down dialog state
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');
  const [drillDownData, setDrillDownData] = useState<DrillDownRecord[]>([]);
  const [drillDownColumns, setDrillDownColumns] = useState<{ key: keyof DrillDownRecord; label: string }[]>([]);

  const locale = i18n.language;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profilesRes, progressRes, stagesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, batch_number'),
        supabase.from('participant_progress').select('*'),
        supabase.from('journey_stages').select('id, name, stage_order, description').eq('is_active', true)
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (progressRes.error) throw progressRes.error;
      if (stagesRes.error) throw stagesRes.error;

      setProfiles(profilesRes.data || []);
      setProgress(progressRes.data || []);
      setStages(stagesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const getStageByOrder = (order: number) => {
    return stages.find(s => s.stage_order === order);
  };

  const getUserProgressForStage = (userId: string, stageId: string) => {
    return progress.find(p => p.user_id === userId && p.stage_id === stageId);
  };

  const updateProgress = async (userId: string, stageId: string, status: string) => {
    setUpdating(userId);
    try {
      const existingProgress = getUserProgressForStage(userId, stageId);
      
      if (existingProgress) {
        const { error } = await supabase
          .from('participant_progress')
          .update({
            status,
            completed_at: status === 'completed' ? new Date().toISOString() : null
          })
          .eq('id', existingProgress.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('participant_progress')
          .insert({
            user_id: userId,
            stage_id: stageId,
            status,
            started_at: new Date().toISOString(),
            completed_at: status === 'completed' ? new Date().toISOString() : null
          });

        if (error) throw error;
      }

      toast.success(t('finance.statusUpdated'));
      fetchData();
    } catch (error) {
      console.error('Error updating progress:', error);
      toast.error(t('common.error'));
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 text-white">{t('common.completed')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500 text-white">{t('common.inProgress')}</Badge>;
      default:
        return <Badge variant="secondary">{t('common.notStarted')}</Badge>;
    }
  };

  // Get unique batch numbers for filter dropdown
  const uniqueBatches = Array.from(new Set(profiles.map(p => p.batch_number).filter(Boolean))) as string[];

  const filteredProfiles = profiles.filter(profile => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = !search || 
      profile.full_name?.toLowerCase().includes(search) ||
      profile.email?.toLowerCase().includes(search) ||
      profile.batch_number?.toLowerCase().includes(search);
    const matchesBatch = batchFilter === 'all' || profile.batch_number === batchFilter;
    return matchesSearch && matchesBatch;
  });

  const getStageStats = (stageOrder: number) => {
    const stage = getStageByOrder(stageOrder);
    if (!stage) return { completed: 0, inProgress: 0, notStarted: 0 };
    
    const stageProgress = progress.filter(p => p.stage_id === stage.id);
    return {
      completed: stageProgress.filter(p => p.status === 'completed').length,
      inProgress: stageProgress.filter(p => p.status === 'in_progress').length,
      notStarted: profiles.length - stageProgress.length
    };
  };

  // Drill-down handler for finance stats
  const handleStatClick = (statusFilter: 'completed' | 'in_progress' | 'pending') => {
    if (!feeStage) return;
    
    let title = '';
    let records: DrillDownRecord[] = [];
    
    if (statusFilter === 'completed') {
      title = t('finance.feesPaid');
      const completedProgress = progress.filter(p => p.stage_id === feeStage.id && p.status === 'completed');
      records = completedProgress.map(p => {
        const profile = profiles.find(pr => pr.id === p.user_id);
        return {
          id: p.id,
          userName: profile?.full_name || t('common.na'),
          email: profile?.email || '-',
          batch: profile?.batch_number || undefined,
          status: 'completed',
          date: p.completed_at ? format(new Date(p.completed_at), 'PPP') : '-',
        };
      });
    } else if (statusFilter === 'in_progress') {
      title = t('common.inProgress');
      const inProgressProgress = progress.filter(p => p.stage_id === feeStage.id && p.status === 'in_progress');
      records = inProgressProgress.map(p => {
        const profile = profiles.find(pr => pr.id === p.user_id);
        return {
          id: p.id,
          userName: profile?.full_name || t('common.na'),
          email: profile?.email || '-',
          batch: profile?.batch_number || undefined,
          status: 'in_progress',
        };
      });
    } else {
      title = t('finance.pending');
      const usersWithProgress = new Set(progress.filter(p => p.stage_id === feeStage.id).map(p => p.user_id));
      const pendingProfiles = profiles.filter(p => !usersWithProgress.has(p.id));
      records = pendingProfiles.map(p => ({
        id: p.id,
        userName: p.full_name || t('common.na'),
        email: p.email || '-',
        batch: p.batch_number || undefined,
        status: 'not_started',
      }));
    }
    
    setDrillDownTitle(title);
    setDrillDownData(records);
    setDrillDownColumns([
      { key: 'userName', label: t('admin.name') },
      { key: 'email', label: t('admin.email') },
      { key: 'batch', label: t('admin.batchNumber') },
      { key: 'status', label: t('finance.status') },
      ...(statusFilter === 'completed' ? [{ key: 'date' as keyof DrillDownRecord, label: t('reports.completedDate') }] : []),
    ]);
    setDrillDownOpen(true);
  };

  // Only finance and admin roles can access
  if (role !== 'finance' && role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">{t('admin.accessDenied')}</CardTitle>
            <CardDescription>{t('finance.noPermission')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const currentStage = getStageByOrder(selectedStage);

  // Reports data calculation
  const feeStage = getStageByOrder(2); // Fees Paid stage
  const feeProgress = feeStage ? progress.filter(p => p.stage_id === feeStage.id) : [];
  
  const reportStats = {
    totalParticipants: profiles.length,
    feesPaid: feeProgress.filter(p => p.status === 'completed').length,
    inProgress: feeProgress.filter(p => p.status === 'in_progress').length,
    pending: profiles.length - feeProgress.filter(p => p.status === 'completed' || p.status === 'in_progress').length,
    completionRate: profiles.length > 0 
      ? Math.round((feeProgress.filter(p => p.status === 'completed').length / profiles.length) * 100) 
      : 0
  };

  // Batch-wise statistics
  const batchStats = uniqueBatches.map(batch => {
    const batchProfiles = profiles.filter(p => p.batch_number === batch);
    const batchUserIds = batchProfiles.map(p => p.id);
    const batchProgress = feeProgress.filter(p => batchUserIds.includes(p.user_id));
    
    return {
      batch,
      total: batchProfiles.length,
      completed: batchProgress.filter(p => p.status === 'completed').length,
      inProgress: batchProgress.filter(p => p.status === 'in_progress').length,
      pending: batchProfiles.length - batchProgress.filter(p => p.status === 'completed' || p.status === 'in_progress').length,
      completionRate: batchProfiles.length > 0 
        ? Math.round((batchProgress.filter(p => p.status === 'completed').length / batchProfiles.length) * 100)
        : 0
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('finance.pageTitle')}</h1>
        <p className="text-muted-foreground">{t('finance.pageSubtitle')}</p>
      </div>

      <Tabs defaultValue="management" className="space-y-6">
        <TabsList>
          <TabsTrigger value="management">
            <DollarSign className="h-4 w-4 mr-2" />
            {t('finance.feeManagement')}
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="h-4 w-4 mr-2" />
            {t('finance.reports')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="management" className="space-y-6">
          {/* Financial Milestone Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            {FINANCIAL_STAGES.map(({ order, name, icon: Icon }) => {
              const stats = getStageStats(order);
              return (
                <Card 
                  key={order} 
                  className={`cursor-pointer transition-colors ${selectedStage === order ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedStage(order)}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{t(`finance.stages.${order}`, name)}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Badge className="bg-green-500">{stats.completed} {t('common.completed')}</Badge>
                      <Badge className="bg-blue-500">{stats.inProgress} {t('common.inProgress')}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {stats.notStarted} {t('finance.pending')}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <div>
                  <CardTitle>
                    {currentStage ? t(`finance.stages.${selectedStage}`, currentStage.name) : t('finance.feeManagement')}
                  </CardTitle>
                  <CardDescription>
                    {currentStage?.description || t('finance.feeManagementDesc')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('admin.searchUsers')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={batchFilter} onValueChange={setBatchFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t('finance.filterByBatch')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('finance.allBatches')}</SelectItem>
                    {uniqueBatches.map((batch) => (
                      <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.name')}</TableHead>
                    <TableHead>{t('admin.email')}</TableHead>
                    <TableHead>{t('admin.batchNumber')}</TableHead>
                    <TableHead>{t('finance.status')}</TableHead>
                    <TableHead>{t('coach.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((profile) => {
                    const userProgress = currentStage 
                      ? getUserProgressForStage(profile.id, currentStage.id)
                      : null;
                    const status = userProgress?.status || 'not_started';

                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.full_name || t('common.na')}</TableCell>
                        <TableCell>{profile.email || '-'}</TableCell>
                        <TableCell>
                          {profile.batch_number ? (
                            <Badge variant="outline">{profile.batch_number}</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(status)}</TableCell>
                        <TableCell>
                          {currentStage && (
                            <Select
                              value={status}
                              onValueChange={(value) => updateProgress(profile.id, currentStage.id, value)}
                              disabled={updating === profile.id}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not_started">{t('common.notStarted')}</SelectItem>
                                <SelectItem value="in_progress">{t('common.inProgress')}</SelectItem>
                                <SelectItem value="completed">{t('common.completed')}</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          {/* Export Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                const exportData = profiles.map(profile => {
                  const userProg = feeStage ? progress.find(p => p.user_id === profile.id && p.stage_id === feeStage.id) : null;
                  return {
                    name: profile.full_name || '',
                    email: profile.email || '',
                    batch: profile.batch_number || '',
                    status: userProg?.status || 'not_started',
                  };
                });
                downloadCSV(exportData, 'finance_report', {
                  name: t('admin.name'),
                  email: t('admin.email'),
                  batch: t('admin.batchNumber'),
                  status: t('finance.status'),
                });
                toast.success(t('common.exportSuccess'));
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              {t('common.exportCSV')}
            </Button>
          </div>

          {/* Summary Statistics - Clickable */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('finance.totalParticipants')}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportStats.totalParticipants}</div>
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleStatClick('completed')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('finance.feesPaid')}</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{reportStats.feesPaid}</div>
                <p className="text-xs text-muted-foreground">{t('reports.clickToViewDetails')}</p>
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleStatClick('in_progress')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('common.inProgress')}</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{reportStats.inProgress}</div>
                <p className="text-xs text-muted-foreground">{t('reports.clickToViewDetails')}</p>
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleStatClick('pending')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('finance.pending')}</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{reportStats.pending}</div>
                <p className="text-xs text-muted-foreground">{t('reports.clickToViewDetails')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('finance.completionRate')}</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportStats.completionRate}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Pie Chart and Batch Breakdown */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t('finance.paymentDistribution')}</CardTitle>
                <CardDescription>{t('finance.paymentDistributionDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: t('finance.feesPaid'), value: reportStats.feesPaid, color: '#22c55e' },
                          { name: t('common.inProgress'), value: reportStats.inProgress, color: '#3b82f6' },
                          { name: t('finance.pending'), value: reportStats.pending, color: '#f97316' },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {[
                          { name: t('finance.feesPaid'), value: reportStats.feesPaid, color: '#22c55e' },
                          { name: t('common.inProgress'), value: reportStats.inProgress, color: '#3b82f6' },
                          { name: t('finance.pending'), value: reportStats.pending, color: '#f97316' },
                        ].filter(d => d.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Batch-wise Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>{t('finance.batchWiseBreakdown')}</CardTitle>
                <CardDescription>{t('finance.batchWiseBreakdownDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.batchNumber')}</TableHead>
                      <TableHead className="text-center">{t('finance.feesPaid')}</TableHead>
                      <TableHead className="text-center">{t('finance.pending')}</TableHead>
                      <TableHead className="text-center">{t('finance.completionRate')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchStats.map(({ batch, completed, pending, completionRate }) => (
                      <TableRow key={batch}>
                        <TableCell className="font-medium">
                          <Badge variant="outline">{batch}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-green-500">{completed}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{pending}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={completionRate >= 75 ? 'text-green-600 font-bold' : completionRate >= 50 ? 'text-blue-600' : 'text-orange-600'}>
                            {completionRate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {batchStats.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          {t('common.noData')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Drill-down Dialog */}
      <AnalyticsDetailDialog
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        title={drillDownTitle}
        data={drillDownData}
        columns={drillDownColumns}
      />
    </div>
  );
};

export default Finance;