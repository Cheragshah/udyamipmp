import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Clock, FileText, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatLocalizedNumber, formatLocalizedCurrency, formatLocalizedPercent } from '@/lib/formatters';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user, role, profile } = useAuth();
  const [stats, setStats] = useState({
    tasksCompleted: 0,
    totalTasks: 32,
    documentsApproved: 0,
    totalDocuments: 6,
    attendancePercent: 0,
    tradeVolume: 0,
    completedStages: 0,
    totalStages: 11,
  });
  const [journeyStages, setJourneyStages] = useState<{ id: string; name: string; completed: boolean; order: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const locale = i18n.language;

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch journey stages
      const { data: stages } = await supabase
        .from('journey_stages')
        .select('id, name, stage_order')
        .eq('is_active', true)
        .order('stage_order')
        .limit(6);

      // Fetch user's progress
      const { data: progress } = await supabase
        .from('participant_progress')
        .select('stage_id, status')
        .eq('user_id', user?.id);

      // Fetch task submissions
      const { data: submissions } = await supabase
        .from('task_submissions')
        .select('status')
        .eq('user_id', user?.id);

      // Fetch documents
      const { data: documents } = await supabase
        .from('documents')
        .select('status')
        .eq('user_id', user?.id);

      // Fetch trades
      const { data: trades } = await supabase
        .from('trades')
        .select('amount')
        .eq('user_id', user?.id);

      // Fetch attendance
      const { data: attendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', user?.id);

      const completedStages = progress?.filter((p) => p.status === 'completed').length || 0;
      const tasksCompleted = submissions?.filter((s) => s.status === 'verified').length || 0;
      const documentsApproved = documents?.filter((d) => d.status === 'approved').length || 0;
      const tradeVolume = trades?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      setStats({
        tasksCompleted,
        totalTasks: 32,
        documentsApproved,
        totalDocuments: 6,
        attendancePercent: attendance?.length ? Math.min(100, Math.round((attendance.length / 30) * 100)) : 0,
        tradeVolume,
        completedStages,
        totalStages: 11,
      });

      if (stages && progress) {
        setJourneyStages(
          stages.map((s) => ({
            id: s.id,
            name: s.name,
            order: s.stage_order,
            completed: progress.some((p) => p.stage_id === s.id && p.status === 'completed'),
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const overallProgress = Math.round(
    ((stats.completedStages / stats.totalStages) * 0.4 +
      (stats.tasksCompleted / stats.totalTasks) * 0.4 +
      (stats.documentsApproved / stats.totalDocuments) * 0.2) *
      100
  );

  const statCards = [
    { label: t('dashboard.tasksCompleted'), value: `${formatLocalizedNumber(stats.tasksCompleted, locale)}/${formatLocalizedNumber(stats.totalTasks, locale)}`, icon: CheckCircle2, color: 'text-success' },
    { label: t('dashboard.documents'), value: `${formatLocalizedNumber(stats.documentsApproved, locale)}/${formatLocalizedNumber(stats.totalDocuments, locale)}`, icon: FileText, color: 'text-accent' },
    { label: t('dashboard.attendance'), value: formatLocalizedPercent(stats.attendancePercent, locale), icon: Clock, color: 'text-warning' },
    { label: t('dashboard.tradeVolume'), value: formatLocalizedCurrency(stats.tradeVolume, locale), icon: TrendingUp, color: 'text-chart-4' },
  ];

  // Translate stage name
  const translateStageName = (name: string) => {
    const translatedName = t(`stages.${name}`, { defaultValue: '' });
    return translatedName || name;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greetingMorning');
    if (hour < 17) return t('dashboard.greetingAfternoon');
    return t('dashboard.greetingEvening');
  };

  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {firstName ? `${getGreeting()}, ${firstName}!` : getGreeting()}
        </h1>
        <p className="text-muted-foreground mt-1">
          {role === 'admin' ? t('dashboard.adminSubtitle') : role === 'coach' ? t('dashboard.coachSubtitle') : t('dashboard.subtitle')}
        </p>
      </div>

      {/* Stats Grid - Only visible for participants */}
      {role === 'participant' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Journey Progress - Only visible for participants */}
      {role === 'participant' && (
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('dashboard.journeyProgress')}</CardTitle>
            <Link to="/journey">
              <Button variant="ghost" size="sm" className="gap-1">
                {t('dashboard.viewFullJourney')} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">{t('dashboard.overallProgress')}</span>
                <span className="font-medium">{formatLocalizedPercent(overallProgress, locale)}</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {journeyStages.map((stage, i) => (
                <Link 
                  key={stage.id} 
                  to={`/journey?stage=${stage.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors cursor-pointer group"
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${stage.completed ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'} group-hover:scale-110 transition-transform`}>
                    {stage.completed ? '✓' : formatLocalizedNumber(i + 1, locale)}
                  </div>
                  <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {translateStageName(stage.name)}
                  </span>
                  <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
