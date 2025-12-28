import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { CheckCircle, FileText, Target, Loader2 } from 'lucide-react';

interface BulkActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  onComplete: () => void;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  submissionId?: string;
}

interface DocItem {
  id: string;
  document_name: string;
  document_type: string;
  status: string;
}

interface StageItem {
  id: string;
  name: string;
  status: string;
}

export default function BulkActionsDialog({ open, onOpenChange, userId, userName, onComplete }: BulkActionsDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [stages, setStages] = useState<StageItem[]>([]);
  
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const [tasksRes, submissionsRes, docsRes, stagesRes, progressRes] = await Promise.all([
        supabase.from('tasks').select('id, title').order('task_order'),
        supabase.from('task_submissions').select('*').eq('user_id', userId),
        supabase.from('documents').select('*').eq('user_id', userId),
        supabase.from('journey_stages').select('*').order('stage_order'),
        supabase.from('participant_progress').select('*').eq('user_id', userId)
      ]);

      // Map tasks with submission status
      const taskItems: TaskItem[] = (tasksRes.data || []).map(task => {
        const submission = submissionsRes.data?.find(s => s.task_id === task.id);
        return {
          id: task.id,
          title: task.title,
          status: submission?.status || 'not_started',
          submissionId: submission?.id
        };
      });
      setTasks(taskItems);

      // Documents
      setDocuments((docsRes.data || []).map(d => ({
        id: d.id,
        document_name: d.document_name,
        document_type: d.document_type,
        status: d.status
      })));

      // Stages with progress
      const stageItems: StageItem[] = (stagesRes.data || []).map(stage => {
        const progress = progressRes.data?.find(p => p.stage_id === stage.id);
        return {
          id: stage.id,
          name: stage.name,
          status: progress?.status || 'not_started'
        };
      });
      setStages(stageItems);
    } catch (error) {
      console.error('Error fetching bulk action data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  useState(() => {
    if (open) {
      fetchData();
    }
  });

  const pendingTasks = tasks.filter(t => t.status === 'submitted' || t.status === 'in_progress');
  const pendingDocs = documents.filter(d => d.status === 'pending' || d.status === 'submitted');
  const incompleteStages = stages.filter(s => s.status !== 'completed');

  const handleApproveAllTasks = async () => {
    if (selectedTasks.length === 0) return;
    setLoading(true);

    try {
      const tasksToApprove = tasks.filter(t => selectedTasks.includes(t.id));
      
      for (const task of tasksToApprove) {
        if (task.submissionId) {
          await supabase.from('task_submissions').update({
            status: 'verified',
            verified_by: user?.id,
            verified_at: new Date().toISOString(),
            verification_notes: 'Bulk approved by admin'
          }).eq('id', task.submissionId);
        } else {
          await supabase.from('task_submissions').insert({
            user_id: userId,
            task_id: task.id,
            status: 'verified',
            submission_notes: 'Bulk submitted by admin',
            submitted_at: new Date().toISOString(),
            verified_by: user?.id,
            verified_at: new Date().toISOString(),
            verification_notes: 'Bulk approved by admin'
          });
        }
      }

      toast.success(t('admin.bulkTasksApproved', { count: selectedTasks.length }));
      setSelectedTasks([]);
      fetchData();
      onComplete();
    } catch (error) {
      console.error('Error bulk approving tasks:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAllDocs = async () => {
    if (selectedDocs.length === 0) return;
    setLoading(true);

    try {
      await supabase.from('documents').update({
        status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: 'Bulk approved by admin'
      }).in('id', selectedDocs);

      toast.success(t('admin.bulkDocsApproved', { count: selectedDocs.length }));
      setSelectedDocs([]);
      fetchData();
      onComplete();
    } catch (error) {
      console.error('Error bulk approving documents:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteAllStages = async () => {
    if (selectedStages.length === 0) return;
    setLoading(true);

    try {
      for (const stageId of selectedStages) {
        const existingProgress = stages.find(s => s.id === stageId);
        
        const { data: existing } = await supabase
          .from('participant_progress')
          .select('id')
          .eq('user_id', userId)
          .eq('stage_id', stageId)
          .maybeSingle();

        if (existing) {
          await supabase.from('participant_progress').update({
            status: 'completed',
            completed_at: new Date().toISOString()
          }).eq('id', existing.id);
        } else {
          await supabase.from('participant_progress').insert({
            user_id: userId,
            stage_id: stageId,
            status: 'completed',
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          });
        }
      }

      toast.success(t('admin.bulkStagesCompleted', { count: selectedStages.length }));
      setSelectedStages([]);
      fetchData();
      onComplete();
    } catch (error) {
      console.error('Error bulk completing stages:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
      case 'approved':
      case 'completed':
        return <Badge className="bg-green-500 text-white">{status}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{status}</Badge>;
      case 'submitted':
      case 'pending':
      case 'in_progress':
        return <Badge variant="secondary">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('admin.bulkActions')}</DialogTitle>
          <DialogDescription>
            {t('admin.bulkActionsFor', { name: userName })}
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="tasks" className="flex-1 overflow-hidden">
            <TabsList className="mb-4">
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {t('admin.tasks')} ({pendingTasks.length})
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t('admin.documents')} ({pendingDocs.length})
              </TabsTrigger>
              <TabsTrigger value="stages" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t('admin.stages')} ({incompleteStages.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTasks(pendingTasks.map(t => t.id))}
                >
                  {t('admin.selectAllPending')}
                </Button>
                <Button
                  onClick={handleApproveAllTasks}
                  disabled={selectedTasks.length === 0 || loading}
                  size="sm"
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('admin.approveSelected')} ({selectedTasks.length})
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {tasks.map(task => (
                    <div 
                      key={task.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => setSelectedTasks(prev => 
                        prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id]
                      )}
                    >
                      <Checkbox checked={selectedTasks.includes(task.id)} />
                      <span className="flex-1">{task.title}</span>
                      {getStatusBadge(task.status)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="documents" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDocs(pendingDocs.map(d => d.id))}
                >
                  {t('admin.selectAllPending')}
                </Button>
                <Button
                  onClick={handleApproveAllDocs}
                  disabled={selectedDocs.length === 0 || loading}
                  size="sm"
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('admin.approveSelected')} ({selectedDocs.length})
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div 
                      key={doc.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => setSelectedDocs(prev => 
                        prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
                      )}
                    >
                      <Checkbox checked={selectedDocs.includes(doc.id)} />
                      <span className="flex-1">{doc.document_name}</span>
                      <Badge variant="outline">{doc.document_type}</Badge>
                      {getStatusBadge(doc.status)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="stages" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStages(incompleteStages.map(s => s.id))}
                >
                  {t('admin.selectAllIncomplete')}
                </Button>
                <Button
                  onClick={handleCompleteAllStages}
                  disabled={selectedStages.length === 0 || loading}
                  size="sm"
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('admin.completeSelected')} ({selectedStages.length})
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {stages.map(stage => (
                    <div 
                      key={stage.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => setSelectedStages(prev => 
                        prev.includes(stage.id) ? prev.filter(id => id !== stage.id) : [...prev, stage.id]
                      )}
                    >
                      <Checkbox checked={selectedStages.includes(stage.id)} />
                      <span className="flex-1">{stage.name}</span>
                      {getStatusBadge(stage.status)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
