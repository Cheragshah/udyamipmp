import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, FileText, Target } from 'lucide-react';

interface JourneyStatsProps {
  completedStages: number;
  totalStages: number;
  completedTasks: number;
  totalTasks: number;
  documentsSubmitted: number;
  totalDocuments: number;
}

export default function JourneyStats({
  completedStages,
  totalStages,
  completedTasks,
  totalTasks,
  documentsSubmitted,
  totalDocuments,
}: JourneyStatsProps) {
  const { t } = useTranslation();
  
  const overallProgress = Math.round(
    ((completedStages / totalStages) * 0.4 +
      (completedTasks / totalTasks) * 0.4 +
      (documentsSubmitted / totalDocuments) * 0.2) *
      100
  );

  const stats = [
    {
      label: t('journey.overallProgress'),
      value: `${overallProgress}%`,
      icon: Target,
      color: 'text-primary',
    },
    {
      label: t('journey.stagesCompleted'),
      value: `${completedStages}/${totalStages}`,
      icon: CheckCircle2,
      color: 'text-success',
    },
    {
      label: t('journey.tasksDone'),
      value: `${completedTasks}/${totalTasks}`,
      icon: Clock,
      color: 'text-accent',
    },
    {
      label: t('journey.documents'),
      value: `${documentsSubmitted}/${totalDocuments}`,
      icon: FileText,
      color: 'text-warning',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="bg-card border border-border/50 rounded-xl p-4 flex items-center gap-4"
          >
            <div className={`p-2 rounded-lg bg-secondary/50 ${stat.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
