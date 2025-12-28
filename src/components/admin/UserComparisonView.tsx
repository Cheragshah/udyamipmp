import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { X, GitCompare, CheckCircle, Clock, Target, FileText, TrendingUp } from 'lucide-react';
import type { Profile, AppRole } from '@/types/database';

interface UserWithRole extends Profile {
  role: AppRole;
  batch_number?: string | null;
}

interface ComparisonData {
  userId: string;
  userName: string;
  batchNumber: string | null;
  stagesCompleted: number;
  totalStages: number;
  tasksCompleted: number;
  totalTasks: number;
  docsApproved: number;
  totalDocs: number;
  tradesApproved: number;
  tradeVolume: number;
  overallProgress: number;
}

interface UserComparisonViewProps {
  users: UserWithRole[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserComparisonView({ users, open, onOpenChange }: UserComparisonViewProps) {
  const { t } = useTranslation();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [loading, setLoading] = useState(false);

  const participants = users.filter(u => u.role === 'participant');

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : prev.length < 5 ? [...prev, userId] : prev
    );
  };

  const fetchComparisonData = async () => {
    if (selectedUserIds.length === 0) return;
    setLoading(true);

    try {
      const [stagesRes, progressRes, tasksRes, submissionsRes, docsRes, tradesRes] = await Promise.all([
        supabase.from('journey_stages').select('id'),
        supabase.from('participant_progress').select('*').in('user_id', selectedUserIds),
        supabase.from('tasks').select('id'),
        supabase.from('task_submissions').select('*').in('user_id', selectedUserIds),
        supabase.from('documents').select('*').in('user_id', selectedUserIds),
        supabase.from('trades').select('*').in('user_id', selectedUserIds)
      ]);

      const totalStages = stagesRes.data?.length || 0;
      const totalTasks = tasksRes.data?.length || 0;

      const data: ComparisonData[] = selectedUserIds.map(userId => {
        const user = users.find(u => u.id === userId);
        const userProgress = progressRes.data?.filter(p => p.user_id === userId) || [];
        const userSubmissions = submissionsRes.data?.filter(s => s.user_id === userId) || [];
        const userDocs = docsRes.data?.filter(d => d.user_id === userId) || [];
        const userTrades = tradesRes.data?.filter(t => t.user_id === userId) || [];

        const stagesCompleted = userProgress.filter(p => p.status === 'completed').length;
        const tasksCompleted = userSubmissions.filter(s => s.status === 'verified').length;
        const docsApproved = userDocs.filter(d => d.status === 'approved').length;
        const tradesApproved = userTrades.filter(t => t.status === 'approved').length;
        const tradeVolume = userTrades.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const overallProgress = totalStages > 0 ? Math.round((stagesCompleted / totalStages) * 100) : 0;

        return {
          userId,
          userName: user?.full_name || 'Unknown',
          batchNumber: (user as any)?.batch_number || null,
          stagesCompleted,
          totalStages,
          tasksCompleted,
          totalTasks,
          docsApproved,
          totalDocs: userDocs.length,
          tradesApproved,
          tradeVolume,
          overallProgress
        };
      });

      setComparisonData(data);
    } catch (error) {
      console.error('Error fetching comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUserIds.length > 0) {
      fetchComparisonData();
    } else {
      setComparisonData([]);
    }
  }, [selectedUserIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            {t('admin.compareUsers')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          {/* User Selection Panel */}
          <div className="w-64 flex-shrink-0 border-r pr-4">
            <p className="text-sm text-muted-foreground mb-2">
              {t('admin.selectUsersToCompare')} ({selectedUserIds.length}/5)
            </p>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-2">
                {participants.map(user => (
                  <div 
                    key={user.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedUserIds.includes(user.id) ? 'bg-primary/10' : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleUser(user.id)}
                  >
                    <Checkbox 
                      checked={selectedUserIds.includes(user.id)}
                      disabled={!selectedUserIds.includes(user.id) && selectedUserIds.length >= 5}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.full_name || 'Unknown'}</p>
                      {(user as any).batch_number && (
                        <Badge variant="outline" className="text-xs">{(user as any).batch_number}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Comparison View */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : comparisonData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {t('admin.selectUsersPrompt')}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Comparison Cards */}
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparisonData.length}, minmax(200px, 1fr))` }}>
                  {comparisonData.map(data => (
                    <Card key={data.userId}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="truncate">{data.userName}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => setSelectedUserIds(prev => prev.filter(id => id !== data.userId))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </CardTitle>
                        {data.batchNumber && (
                          <Badge variant="outline" className="w-fit">{data.batchNumber}</Badge>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Overall Progress */}
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="flex items-center gap-1">
                              <Target className="h-4 w-4 text-primary" />
                              {t('userDetail.progress')}
                            </span>
                            <span className="font-bold">{data.overallProgress}%</span>
                          </div>
                          <Progress value={data.overallProgress} className="h-2" />
                        </div>

                        {/* Stages */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            {t('journey.stagesCompleted')}
                          </span>
                          <span className="font-medium">{data.stagesCompleted}/{data.totalStages}</span>
                        </div>

                        {/* Tasks */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-blue-500" />
                            {t('userDetail.tasks')}
                          </span>
                          <span className="font-medium">{data.tasksCompleted}/{data.totalTasks}</span>
                        </div>

                        {/* Documents */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <FileText className="h-4 w-4 text-purple-500" />
                            {t('userDetail.documents')}
                          </span>
                          <span className="font-medium">{data.docsApproved}/{data.totalDocs}</span>
                        </div>

                        {/* Trades */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-amber-500" />
                            {t('userDetail.trades')}
                          </span>
                          <span className="font-medium">{data.tradesApproved}</span>
                        </div>

                        {/* Trade Volume */}
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">{t('userDetail.totalTradeVolume')}</p>
                          <p className="text-lg font-bold">₹{data.tradeVolume.toLocaleString()}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Detailed Comparison Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t('admin.detailedComparison')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('admin.metric')}</TableHead>
                          {comparisonData.map(data => (
                            <TableHead key={data.userId}>{data.userName}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">{t('admin.batchNumber')}</TableCell>
                          {comparisonData.map(data => (
                            <TableCell key={data.userId}>{data.batchNumber || '-'}</TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{t('userDetail.progress')}</TableCell>
                          {comparisonData.map(data => (
                            <TableCell key={data.userId}>{data.overallProgress}%</TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{t('journey.stagesCompleted')}</TableCell>
                          {comparisonData.map(data => (
                            <TableCell key={data.userId}>{data.stagesCompleted}/{data.totalStages}</TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{t('userDetail.tasks')}</TableCell>
                          {comparisonData.map(data => (
                            <TableCell key={data.userId}>{data.tasksCompleted}/{data.totalTasks}</TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{t('userDetail.documents')}</TableCell>
                          {comparisonData.map(data => (
                            <TableCell key={data.userId}>{data.docsApproved}</TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{t('userDetail.trades')}</TableCell>
                          {comparisonData.map(data => (
                            <TableCell key={data.userId}>{data.tradesApproved}</TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{t('userDetail.totalTradeVolume')}</TableCell>
                          {comparisonData.map(data => (
                            <TableCell key={data.userId}>₹{data.tradeVolume.toLocaleString()}</TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
