import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { History, CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';
import { formatLocalizedDate } from '@/lib/formatters';

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  user_id: string;
  action: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
  changed_by_name?: string;
}

interface AuditHistoryPopupProps {
  tableName: string;
  recordId: string;
  trigger?: React.ReactNode;
}

export default function AuditHistoryPopup({ tableName, recordId, trigger }: AuditHistoryPopupProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const locale = i18n.language;

  useEffect(() => {
    if (open && recordId) {
      fetchAuditLogs();
    }
  }, [open, recordId]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile names for changed_by
      const changedByIds = [...new Set((data || []).map(log => log.changed_by).filter(Boolean))];
      
      let profiles: { id: string; full_name: string }[] = [];
      if (changedByIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', changedByIds);
        profiles = profileData || [];
      }

      const enrichedLogs = (data || []).map(log => ({
        ...log,
        changed_by_name: profiles.find(p => p.id === log.changed_by)?.full_name || t('auditHistory.system')
      }));

      setLogs(enrichedLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'approved':
        return <Badge className="bg-success text-success-foreground">{t('auditHistory.approved')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{t('auditHistory.rejected')}</Badge>;
      case 'status_changed':
        return <Badge variant="secondary">{t('auditHistory.statusChanged')}</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    switch (status) {
      case 'verified':
      case 'approved':
      case 'completed':
        return <Badge className="bg-success/20 text-success border-success/30">{status}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{status}</Badge>;
      case 'submitted':
      case 'pending':
        return <Badge variant="secondary">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <DialogTrigger asChild>
            <TooltipTrigger asChild>
              {trigger || (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <History className="h-4 w-4" />
                </Button>
              )}
            </TooltipTrigger>
          </DialogTrigger>
          <TooltipContent>
            <p>{t('auditHistory.viewHistory')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t('auditHistory.title')}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[400px] pr-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('auditHistory.noHistory')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log, index) => (
                <div 
                  key={log.id} 
                  className="relative pl-6 pb-4 border-l-2 border-border last:border-l-0"
                >
                  {/* Timeline dot */}
                  <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                    {getActionIcon(log.action)}
                  </div>
                  
                  <div className="space-y-2">
                    {/* Timestamp */}
                    <p className="text-xs text-muted-foreground">
                      {formatLocalizedDate(log.created_at, 'PPp', locale)}
                    </p>
                    
                    {/* Action badge */}
                    <div className="flex items-center gap-2">
                      {getActionBadge(log.action)}
                      <span className="text-sm text-muted-foreground">
                        {t('auditHistory.by')} {log.changed_by_name}
                      </span>
                    </div>
                    
                    {/* Status change */}
                    {log.old_status && (
                      <div className="flex items-center gap-2 text-sm">
                        {getStatusBadge(log.old_status)}
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {getStatusBadge(log.new_status)}
                      </div>
                    )}
                    
                    {/* Notes */}
                    {log.notes && (
                      <p className="text-sm bg-muted/50 p-2 rounded text-muted-foreground">
                        {log.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
