import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, CheckCircle, Circle } from 'lucide-react';
import { formatLocalizedDate } from '@/lib/formatters';

interface SessionCompletionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  onComplete: () => void;
}

const SESSION_TYPES = [
  { id: 'offline_orientation', label: 'Offline Orientation' },
  { id: 'online_orientation', label: 'Online Orientation' },
  { id: 'special_session', label: 'Special Session' },
  { id: 'ohm_offline_meet', label: 'OHM Offline Meet' },
  { id: 'udyami_ai_access', label: 'Udyami AI Access' }
];

interface SessionCompletion {
  id: string;
  session_type: string;
  completed_at: string;
  notes: string | null;
  marked_by_name?: string;
}

export default function SessionCompletionManager({ 
  open, 
  onOpenChange, 
  userId, 
  userName, 
  onComplete 
}: SessionCompletionManagerProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const locale = i18n.language;
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [completions, setCompletions] = useState<SessionCompletion[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const fetchCompletions = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('user_session_completions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const { data: profiles } = await supabase.from('profiles').select('id, full_name');
      
      const enriched = (data || []).map(c => ({
        ...c,
        marked_by_name: profiles?.find(p => p.id === c.marked_by)?.full_name || 'Admin'
      }));

      setCompletions(enriched);
    } catch (error) {
      console.error('Error fetching session completions:', error);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCompletions();
      setNotes({});
    }
  }, [open, userId]);

  const isCompleted = (sessionType: string) => {
    return completions.some(c => c.session_type === sessionType);
  };

  const getCompletion = (sessionType: string) => {
    return completions.find(c => c.session_type === sessionType);
  };

  const handleToggleSession = async (sessionType: string) => {
    setLoading(true);
    try {
      const existing = getCompletion(sessionType);

      if (existing) {
        // Remove completion
        await supabase.from('user_session_completions').delete().eq('id', existing.id);
        toast.success(t('admin.sessionMarkedIncomplete'));
      } else {
        // Add completion
        await supabase.from('user_session_completions').insert({
          user_id: userId,
          session_type: sessionType,
          marked_by: user?.id,
          notes: notes[sessionType] || null
        });
        toast.success(t('admin.sessionMarkedComplete'));
      }

      fetchCompletions();
      onComplete();
    } catch (error) {
      console.error('Error toggling session:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('admin.manageSessionCompletions')}</DialogTitle>
          <DialogDescription>
            {t('admin.sessionCompletionsFor', { name: userName })}
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              {SESSION_TYPES.map(session => {
                const completed = isCompleted(session.id);
                const completion = getCompletion(session.id);

                return (
                  <div 
                    key={session.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      completed ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 mt-0.5"
                        onClick={() => handleToggleSession(session.id)}
                        disabled={loading}
                      >
                        {completed ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </Button>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${completed ? 'text-green-700 dark:text-green-300' : ''}`}>
                            {t(`stages.${session.label}`) || session.label}
                          </span>
                          {completed && (
                            <Badge className="bg-green-500 text-white">{t('common.completed')}</Badge>
                          )}
                        </div>
                        
                        {completed && completion && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            <p>{t('admin.completedOn')}: {formatLocalizedDate(completion.completed_at, 'PPp', locale)}</p>
                            <p>{t('admin.markedBy')}: {completion.marked_by_name}</p>
                            {completion.notes && (
                              <p className="mt-1 italic">{completion.notes}</p>
                            )}
                          </div>
                        )}

                        {!completed && (
                          <div className="mt-2">
                            <Textarea
                              placeholder={t('admin.sessionNotesPlaceholder')}
                              value={notes[session.id] || ''}
                              onChange={(e) => setNotes(prev => ({ ...prev, [session.id]: e.target.value }))}
                              className="text-sm"
                              rows={2}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
