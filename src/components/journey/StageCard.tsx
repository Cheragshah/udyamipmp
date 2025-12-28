import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JourneyStage } from '@/types/database';

interface StageCardProps {
  stage: JourneyStage;
  status: 'completed' | 'active' | 'locked';
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

export default function StageCard({
  stage,
  status,
  isExpanded,
  onToggle,
  children,
}: StageCardProps) {
  const { t } = useTranslation();

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-6 w-6 text-success" />;
      case 'active':
        return (
          <div className="h-6 w-6 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          </div>
        );
      case 'locked':
        return <Lock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'completed':
        return <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">{t('common.completed')}</span>;
      case 'active':
        return <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">{t('common.inProgress')}</span>;
      case 'locked':
        return <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{t('common.locked')}</span>;
    }
  };

  // Get translated stage description
  const getStageDescription = () => {
    // First try to get the translated description from stageDescriptions
    const originalName = stage.name;
    const translatedDesc = t(`stageDescriptions.${originalName}`, { defaultValue: '' });
    if (translatedDesc) return translatedDesc;
    // Fall back to the stage's description if available
    return stage.description || '';
  };

  return (
    <div
      className={cn(
        'relative transition-all duration-300',
        status === 'active' && 'scale-[1.02]'
      )}
    >
      <div
        className={cn(
          'bg-card border rounded-xl overflow-hidden transition-all duration-300',
          status === 'completed' && 'border-success/30 bg-success/5',
          status === 'active' && 'border-primary shadow-lg shadow-primary/10',
          status === 'locked' && 'border-border/30 opacity-60'
        )}
      >
        <button
          onClick={onToggle}
          disabled={status === 'locked'}
          className="w-full p-4 flex items-center gap-4 text-left hover:bg-secondary/30 transition-colors disabled:cursor-not-allowed"
        >
          {/* Stage Number */}
          <div
            className={cn(
              'flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold',
              status === 'completed' && 'bg-success text-success-foreground',
              status === 'active' && 'bg-primary text-primary-foreground',
              status === 'locked' && 'bg-muted text-muted-foreground'
            )}
          >
            {stage.stage_order}
          </div>

          {/* Stage Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{stage.name}</h3>
            <p className="text-sm text-muted-foreground truncate">{getStageDescription()}</p>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            {getStatusLabel()}
            {getStatusIcon()}
            {children && status !== 'locked' && (
              isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )
            )}
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && children && status !== 'locked' && (
          <div className="px-4 pb-4 pt-0 border-t border-border/50">
            <div className="pt-4">{children}</div>
          </div>
        )}
      </div>
    </div>
  );
}
