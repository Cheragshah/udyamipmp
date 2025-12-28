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
import { Store, Search, Loader2, ShoppingCart, BarChart3, PieChart as PieChartIcon, Download } from 'lucide-react';
import ECommerceManager from '@/components/admin/ECommerceManager';
import { downloadCSV } from '@/lib/exportUtils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter';
import { AnalyticsDetailDialog, DrillDownRecord } from '@/components/analytics/AnalyticsDetailDialog';

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#8b5cf6', '#06b6d4', '#ef4444'];

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

interface ECommerceSetup {
  id: string;
  user_id: string;
  platform: string | null;
  status: string;
}

const PLATFORMS = ['amazon', 'flipkart', 'own_website', 'shopify', 'indiamart', 'other'];

const ECommerce = () => {
  const { t, i18n } = useTranslation();
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [progress, setProgress] = useState<ParticipantProgress[]>([]);
  const [stages, setStages] = useState<JourneyStage[]>([]);
  const [setups, setSetups] = useState<ECommerceSetup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  
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
      const [profilesRes, progressRes, stagesRes, setupsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, batch_number'),
        supabase.from('participant_progress').select('*'),
        supabase.from('journey_stages').select('id, name, stage_order, description').eq('is_active', true),
        supabase.from('ecommerce_setups').select('id, user_id, platform, status')
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (progressRes.error) throw progressRes.error;
      if (stagesRes.error) throw stagesRes.error;
      if (setupsRes.error) throw setupsRes.error;

      setProfiles(profilesRes.data || []);
      setProgress(progressRes.data || []);
      setStages(stagesRes.data || []);
      setSetups(setupsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const getEcommerceStage = () => {
    return stages.find(s => s.name === 'E-Commerce Setup');
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

      toast.success(t('ecommerce.statusUpdated'));
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

  // Stats from ecommerce_setups table (actual store setups)
  const getSetupStats = () => {
    const completed = setups.filter(s => s.status === 'completed').length;
    const inProgress = setups.filter(s => s.status === 'in_progress' || s.status === 'pending').length;
    const usersWithSetup = new Set(setups.map(s => s.user_id)).size;
    const pending = profiles.length - usersWithSetup;
    return { completed, inProgress, pending, total: setups.length };
  };

  // Platform breakdown for reports
  const getPlatformStats = () => {
    const platformCounts: Record<string, { total: number; completed: number; pending: number }> = {};
    
    PLATFORMS.forEach(platform => {
      platformCounts[platform] = { total: 0, completed: 0, pending: 0 };
    });
    
    setups.forEach(setup => {
      const platform = setup.platform || 'other';
      if (!platformCounts[platform]) {
        platformCounts[platform] = { total: 0, completed: 0, pending: 0 };
      }
      platformCounts[platform].total++;
      if (setup.status === 'completed') {
        platformCounts[platform].completed++;
      } else {
        platformCounts[platform].pending++;
      }
    });
    
    return platformCounts;
  };

  // Drill-down handler for e-commerce stats
  const handleStatClick = (statusFilter: 'completed' | 'in_progress' | 'pending', platformFilter?: string) => {
    let title = '';
    let records: DrillDownRecord[] = [];
    
    if (platformFilter) {
      // Filter by platform
      title = t(`ecommerce.platforms.${platformFilter}`);
      const platformSetups = setups.filter(s => (s.platform || 'other') === platformFilter);
      records = platformSetups.map(s => {
        const profile = profiles.find(p => p.id === s.user_id);
        return {
          id: s.id,
          userName: profile?.full_name || t('common.na'),
          email: profile?.email || '-',
          batch: profile?.batch_number || undefined,
          status: s.status,
          extra: s.platform || 'other',
        };
      });
    } else if (statusFilter === 'completed') {
      title = t('common.completed');
      const completedSetups = setups.filter(s => s.status === 'completed');
      records = completedSetups.map(s => {
        const profile = profiles.find(p => p.id === s.user_id);
        return {
          id: s.id,
          userName: profile?.full_name || t('common.na'),
          email: profile?.email || '-',
          batch: profile?.batch_number || undefined,
          status: 'completed',
          extra: s.platform ? t(`ecommerce.platforms.${s.platform}`) : '-',
        };
      });
    } else if (statusFilter === 'in_progress') {
      title = t('common.inProgress');
      const inProgressSetups = setups.filter(s => s.status === 'in_progress' || s.status === 'pending');
      records = inProgressSetups.map(s => {
        const profile = profiles.find(p => p.id === s.user_id);
        return {
          id: s.id,
          userName: profile?.full_name || t('common.na'),
          email: profile?.email || '-',
          batch: profile?.batch_number || undefined,
          status: s.status,
          extra: s.platform ? t(`ecommerce.platforms.${s.platform}`) : '-',
        };
      });
    } else {
      title = t('ecommerce.participantsWithoutStore');
      const usersWithSetup = new Set(setups.map(s => s.user_id));
      const pendingProfiles = profiles.filter(p => !usersWithSetup.has(p.id));
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
      ...(statusFilter !== 'pending' || platformFilter ? [{ key: 'extra' as keyof DrillDownRecord, label: t('ecommerce.platform') }] : []),
    ]);
    setDrillDownOpen(true);
  };

  // Only ecommerce, coach, and admin roles can access
  if (role !== 'ecommerce' && role !== 'coach' && role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">{t('admin.accessDenied')}</CardTitle>
            <CardDescription>{t('ecommerce.noPermission')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const ecommerceStage = getEcommerceStage();
  const setupStats = getSetupStats();
  const platformStats = getPlatformStats();

  // Show stage management only for ecommerce team and admin
  const canManageStage = role === 'ecommerce' || role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('ecommerce.pageTitle')}</h1>
        <p className="text-muted-foreground">{t('ecommerce.pageSubtitle')}</p>
      </div>

      {canManageStage && (
        <>
          {/* E-Commerce Stage Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('ecommerce.storeSetupStatus')}</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  <Badge className="bg-green-500">{setupStats.completed} {t('common.completed')}</Badge>
                  <Badge className="bg-blue-500">{setupStats.inProgress} {t('common.inProgress')}</Badge>
                  <Badge variant="secondary">{setupStats.pending} {t('ecommerce.pending')}</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('ecommerce.totalStores')}</CardTitle>
                <Store className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{setupStats.total}</div>
                <p className="text-xs text-muted-foreground">{t('ecommerce.storesCreated')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('ecommerce.participantsWithoutStore')}</CardTitle>
                <PieChartIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{setupStats.pending}</div>
                <p className="text-xs text-muted-foreground">{t('ecommerce.needSetup')}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="stores" className="space-y-4">
            <TabsList>
              <TabsTrigger value="stores">
                <Store className="h-4 w-4 mr-2" />
                {t('ecommerce.storeSetups')}
              </TabsTrigger>
              <TabsTrigger value="reports">
                <BarChart3 className="h-4 w-4 mr-2" />
                {t('ecommerce.reports')}
              </TabsTrigger>
              <TabsTrigger value="stage">
                <ShoppingCart className="h-4 w-4 mr-2" />
                {t('ecommerce.stageManagement')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stores">
              <ECommerceManager />
            </TabsContent>

            <TabsContent value="reports">
              {/* Date Filter and Export */}
              <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <DateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onClear={() => { setStartDate(undefined); setEndDate(undefined); }}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const exportData = setups.map(setup => {
                      const profile = profiles.find(p => p.id === setup.user_id);
                      return {
                        name: profile?.full_name || '',
                        email: profile?.email || '',
                        batch: profile?.batch_number || '',
                        platform: setup.platform || '',
                        status: setup.status,
                      };
                    });
                    downloadCSV(exportData, 'ecommerce_report', {
                      name: t('admin.name'),
                      email: t('admin.email'),
                      batch: t('admin.batchNumber'),
                      platform: t('ecommerce.platform'),
                      status: t('finance.status'),
                    });
                    toast.success(t('common.exportSuccess'));
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t('common.exportCSV')}
                </Button>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Platform Breakdown */}
                {/* Platform Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('reports.platformDistribution')}</CardTitle>
                    <CardDescription>{t('reports.platformDistributionDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={PLATFORMS.map((platform, idx) => ({
                              name: t(`ecommerce.platforms.${platform}`),
                              value: platformStats[platform]?.total || 0,
                              color: CHART_COLORS[idx % CHART_COLORS.length]
                            })).filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {PLATFORMS.map((_, idx) => (
                              <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Platform Breakdown Table */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      <div>
                        <CardTitle>{t('ecommerce.platformBreakdown')}</CardTitle>
                        <CardDescription>{t('ecommerce.platformBreakdownDesc')}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('ecommerce.platform')}</TableHead>
                          <TableHead className="text-right">{t('ecommerce.total')}</TableHead>
                          <TableHead className="text-right">{t('common.completed')}</TableHead>
                          <TableHead className="text-right">{t('ecommerce.pending')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {PLATFORMS.map(platform => {
                          const stats = platformStats[platform];
                          if (stats.total === 0) return null;
                          return (
                            <TableRow key={platform}>
                              <TableCell className="font-medium">
                                {t(`ecommerce.platforms.${platform}`)}
                              </TableCell>
                              <TableCell className="text-right">{stats.total}</TableCell>
                              <TableCell className="text-right">
                                <Badge className="bg-green-500">{stats.completed}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary">{stats.pending}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {Object.values(platformStats).every(s => s.total === 0) && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              {t('ecommerce.noSetups')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Summary Stats - Clickable */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      <div>
                        <CardTitle>{t('ecommerce.summaryStats')}</CardTitle>
                        <CardDescription>{t('ecommerce.summaryStatsDesc')}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span className="font-medium">{t('ecommerce.totalParticipants')}</span>
                      <span className="text-2xl font-bold">{profiles.length}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span className="font-medium">{t('ecommerce.totalStores')}</span>
                      <span className="text-2xl font-bold">{setupStats.total}</span>
                    </div>
                    <div 
                      className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg cursor-pointer hover:bg-green-500/20 transition-colors"
                      onClick={() => handleStatClick('completed')}
                    >
                      <span className="font-medium">{t('ecommerce.completedSetups')}</span>
                      <span className="text-2xl font-bold text-green-600">{setupStats.completed}</span>
                    </div>
                    <div 
                      className="flex justify-between items-center p-3 bg-blue-500/10 rounded-lg cursor-pointer hover:bg-blue-500/20 transition-colors"
                      onClick={() => handleStatClick('in_progress')}
                    >
                      <span className="font-medium">{t('ecommerce.inProgressSetups')}</span>
                      <span className="text-2xl font-bold text-blue-600">{setupStats.inProgress}</span>
                    </div>
                    <div 
                      className="flex justify-between items-center p-3 bg-muted rounded-lg cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => handleStatClick('pending')}
                    >
                      <span className="font-medium">{t('ecommerce.participantsWithoutStore')}</span>
                      <span className="text-2xl font-bold text-muted-foreground">{setupStats.pending}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                      <span className="font-medium">{t('ecommerce.completionRate')}</span>
                      <span className="text-2xl font-bold text-primary">
                        {profiles.length > 0 ? Math.round((setupStats.completed / profiles.length) * 100) : 0}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="stage">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    <div>
                      <CardTitle>{t('ecommerce.stageManagement')}</CardTitle>
                      <CardDescription>{t('ecommerce.stageManagementDesc')}</CardDescription>
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
                        <SelectValue placeholder={t('ecommerce.filterByBatch')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('ecommerce.allBatches')}</SelectItem>
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
                        <TableHead>{t('ecommerce.stageStatus')}</TableHead>
                        <TableHead>{t('coach.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProfiles.map((profile) => {
                        const userProgress = ecommerceStage 
                          ? getUserProgressForStage(profile.id, ecommerceStage.id)
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
                              {ecommerceStage && (
                                <Select
                                  value={status}
                                  onValueChange={(value) => updateProgress(profile.id, ecommerceStage.id, value)}
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
          </Tabs>
        </>
      )}

      {/* Coaches only see the store setups */}
      {role === 'coach' && <ECommerceManager />}

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

export default ECommerce;
