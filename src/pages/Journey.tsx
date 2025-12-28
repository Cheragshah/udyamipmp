import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { JourneyStage } from '@/types/database';
import JourneyTimeline from '@/components/journey/JourneyTimeline';
import JourneyStats from '@/components/journey/JourneyStats';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Video } from 'lucide-react';

interface ProgressData {
  id: string;
  user_id: string;
  stage_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface SpecialSessionLink {
  id: string;
  title: string;
  description: string | null;
  link_url: string;
  session_type: string;
}

export default function Journey() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightedStageId = searchParams.get('stage');
  const [stages, setStages] = useState<JourneyStage[]>([]);
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [documents, setDocuments] = useState<{ type: string; status: string }[]>([]);
  const [taskStats, setTaskStats] = useState({ completed: 0, total: 32 });
  const [specialLinks, setSpecialLinks] = useState<SpecialSessionLink[]>([]);
  const [userBatch, setUserBatch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchJourneyData();
    }
  }, [user]);

  const fetchJourneyData = async () => {
    try {
      // Fetch user profile for batch number
      const { data: profileData } = await supabase
        .from('profiles')
        .select('batch_number')
        .eq('id', user?.id)
        .maybeSingle();

      const batch = (profileData as any)?.batch_number || null;
      setUserBatch(batch);

      // Fetch journey stages
      const { data: stagesData } = await supabase
        .from('journey_stages')
        .select('*')
        .eq('is_active', true)
        .order('stage_order');

      // Fetch user's progress
      const { data: progressData } = await supabase
        .from('participant_progress')
        .select('*')
        .eq('user_id', user?.id);

      // Fetch user's documents
      const { data: docsData } = await supabase
        .from('documents')
        .select('document_type, status')
        .eq('user_id', user?.id);

      // Fetch task submissions
      const { data: submissionsData } = await supabase
        .from('task_submissions')
        .select('status')
        .eq('user_id', user?.id);

      // Fetch total tasks count
      const { count: totalTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Fetch special session links (for user's batch or all users)
      const { data: linksData } = await supabase
        .from('special_session_links')
        .select('*')
        .eq('is_active', true)
        .or(`target_batch.is.null,target_batch.eq.${batch || 'none'}`);

      if (stagesData) setStages(stagesData);
      if (progressData) {
        setProgress(progressData.map(p => ({
          ...p,
          status: p.status as 'not_started' | 'in_progress' | 'completed'
        })));
      }
      if (docsData) {
        setDocuments(docsData.map((d) => ({ type: d.document_type, status: d.status })));
      }
      if (submissionsData) {
        const completed = submissionsData.filter((s) => s.status === 'verified').length;
        setTaskStats({ completed, total: totalTasks || 32 });
      }
      if (linksData) {
        setSpecialLinks(linksData);
      }
    } catch (error) {
      console.error('Error fetching journey data:', error);
    } finally {
      setLoading(false);
    }
  };

  const completedStages = progress.filter((p) => p.status === 'completed').length;
  const documentsApproved = documents.filter((d) => d.status === 'approved').length;

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t('journey.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('journey.subtitle')}
        </p>
      </div>

      {/* Stats Overview */}
      <JourneyStats
        completedStages={completedStages}
        totalStages={stages.length}
        completedTasks={taskStats.completed}
        totalTasks={taskStats.total}
        documentsSubmitted={documentsApproved}
        totalDocuments={6}
      />

      {/* Special Session Links */}
      {specialLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              {t('journey.specialSessions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {specialLinks.map((link) => (
                <div 
                  key={link.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-medium">{link.title}</h3>
                      {link.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {link.description}
                        </p>
                      )}
                      <Badge variant="outline" className="mt-2">
                        {link.session_type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href={link.link_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Journey Timeline */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t('journey.timeline')}</h2>
        <JourneyTimeline
          stages={stages}
          progress={progress}
          completedTasks={taskStats.completed}
          totalTasks={taskStats.total}
          documents={documents}
          initialExpandedStageId={highlightedStageId}
        />
      </div>
    </div>
  );
}
