import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ListTodo, Users, Video, Building2, Bot, ShoppingCart } from 'lucide-react';
import StageCard from './StageCard';
import EnrollmentForm from './EnrollmentForm';
import { JourneyStage } from '@/types/database';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface ProgressData {
  id: string;
  user_id: string;
  stage_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface JourneyTimelineProps {
  stages: JourneyStage[];
  progress: ProgressData[];
  completedTasks: number;
  totalTasks: number;
  documents: { type: string; status: string }[];
  initialExpandedStageId?: string | null;
}

const STAGE_ICONS: Record<number, React.ElementType> = {
  1: Users,      // Enrollment
  2: FileText,   // Fees Paid
  3: Users,      // Offline Orientation
  4: Video,      // Online Orientation
  5: FileText,   // Documentation
  6: Users,      // Special Session
  7: ListTodo,   // 32 Tasks
  8: Users,      // OHM Offline Meet
  9: Bot,        // Udyami AI Access
  10: ShoppingCart, // E-Commerce Setup
};

const DOCUMENT_KEYS = ['IEC', 'GST', 'RCMC', 'UDYAM', 'SHOP_ACT', 'PAN'];

export default function JourneyTimeline({
  stages,
  progress,
  completedTasks,
  totalTasks,
  documents,
  initialExpandedStageId,
}: JourneyTimelineProps) {
  const { t } = useTranslation();
  const [expandedStage, setExpandedStage] = useState<string | null>(initialExpandedStageId || null);
  const stageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll to highlighted stage on mount
  useEffect(() => {
    if (initialExpandedStageId && stageRefs.current[initialExpandedStageId]) {
      setExpandedStage(initialExpandedStageId);
      setTimeout(() => {
        stageRefs.current[initialExpandedStageId]?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 100);
    }
  }, [initialExpandedStageId]);

  const getStageStatus = (stageId: string): 'completed' | 'active' | 'locked' => {
    const stageProgress = progress.find((p) => p.stage_id === stageId);
    if (stageProgress?.status === 'completed') return 'completed';
    // All stages are now unlocked - return 'active' instead of 'locked'
    return 'active';
  };

  const getDocumentStatus = (docType: string) => {
    const doc = documents.find((d) => d.type === docType);
    return doc?.status || 'pending';
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return t('journey.approved');
      case 'submitted':
        return t('journey.underReview');
      default:
        return t('journey.pending');
    }
  };

  const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order);

  // Translate stage name
  const translateStageName = (name: string) => {
    const translatedName = t(`stages.${name}`, { defaultValue: '' });
    return translatedName || name;
  };

  return (
    <div className="relative">
      {/* Timeline connector line */}
      <div className="absolute left-[2.25rem] top-8 bottom-8 w-0.5 bg-gradient-to-b from-success via-primary to-muted hidden md:block" />

      <div className="space-y-4">
        {sortedStages.map((stage) => {
          const status = getStageStatus(stage.id);
          const isExpanded = expandedStage === stage.id;
          const Icon = STAGE_ICONS[stage.stage_order] || FileText;
          const isHighlighted = stage.id === initialExpandedStageId;

          // Create a translated stage object
          const translatedStage = {
            ...stage,
            name: translateStageName(stage.name),
          };

          return (
            <div 
              key={stage.id} 
              ref={(el) => { stageRefs.current[stage.id] = el; }}
              className={isHighlighted ? 'ring-2 ring-primary ring-offset-2 rounded-xl' : ''}
            >
              <StageCard
                stage={translatedStage}
                status={status}
                isExpanded={isExpanded}
                onToggle={() => setExpandedStage(isExpanded ? null : stage.id)}
              >
              {/* Stage 5: Documentation Section (merged documentation and verification) */}
              {stage.stage_order === 5 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('journey.submitAndVerifyDocuments')}
                  </p>
                  <div className="grid gap-2">
                    {DOCUMENT_KEYS.map((docKey) => {
                      const docStatus = getDocumentStatus(docKey);
                      return (
                        <div
                          key={docKey}
                          className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                        >
                          <span className="text-sm font-medium">{t(`documentTypes.${docKey}`)}</span>
                          <Badge
                            variant={
                              docStatus === 'approved'
                                ? 'default'
                                : docStatus === 'submitted'
                                ? 'secondary'
                                : 'outline'
                            }
                            className={
                              docStatus === 'approved'
                                ? 'bg-success text-success-foreground'
                                : docStatus === 'submitted'
                                ? 'bg-warning text-warning-foreground'
                                : ''
                            }
                          >
                            {getStatusLabel(docStatus)}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stage 7: 32 Tasks Section */}
              {stage.stage_order === 7 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="border-warning text-warning">
                      {t('journey.dailyAttendanceRequired')}
                    </Badge>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{t('journey.taskProgress')}</span>
                      <span className="font-medium">{completedTasks}/{totalTasks} {t('journey.completed')}</span>
                    </div>
                    <Progress value={(completedTasks / totalTasks) * 100} className="h-3" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('journey.completeAllTasks')}
                  </p>
                </div>
              )}

              {/* Stage 10: E-Commerce & Trade */}
              {stage.stage_order === 10 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t('journey.ecommerceSetup')}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-secondary/30 rounded-lg text-center">
                      <p className="text-2xl font-bold text-primary">0</p>
                      <p className="text-xs text-muted-foreground">{t('journey.totalTrades')}</p>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-lg text-center">
                      <p className="text-2xl font-bold text-success">₹0</p>
                      <p className="text-xs text-muted-foreground">{t('journey.tradeVolume')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Stage 1: Enrollment Form */}
              {stage.stage_order === 1 && (
                <EnrollmentForm />
              )}

              {/* Default stage content */}
              {![1, 5, 7, 10].includes(stage.stage_order) && (
                <p className="text-sm text-muted-foreground">
                  {stage.description || t('journey.completeStage')}
                </p>
              )}
            </StageCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}
