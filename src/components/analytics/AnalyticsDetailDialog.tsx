import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { downloadCSV } from '@/lib/exportUtils';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface DrillDownRecord {
  id: string;
  userName: string;
  email: string;
  batch?: string;
  status?: string;
  value?: string | number;
  date?: string;
  extra?: string;
}

interface AnalyticsDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  data: DrillDownRecord[];
  columns: { key: keyof DrillDownRecord; label: string }[];
}

export const AnalyticsDetailDialog = ({
  open,
  onOpenChange,
  title,
  description,
  data,
  columns,
}: AnalyticsDetailDialogProps) => {
  const { t } = useTranslation();

  const handleExport = () => {
    const headers: Record<string, string> = {};
    columns.forEach(col => {
      headers[col.key as string] = col.label;
    });
    
    const exportData = data.map(record => {
      const row: Record<string, string | number | undefined> = {};
      columns.forEach(col => {
        row[col.key as string] = record[col.key];
      });
      return row;
    });
    
    downloadCSV(exportData, `analytics_${title.toLowerCase().replace(/\s+/g, '_')}`, headers);
    toast.success(t('common.exportSuccess'));
  };

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      completed: 'bg-green-500',
      verified: 'bg-green-500',
      approved: 'bg-green-500',
      in_progress: 'bg-blue-500',
      submitted: 'bg-blue-500',
      pending: 'bg-orange-500',
      not_started: 'bg-muted',
      rejected: 'bg-destructive',
    };
    return (
      <Badge className={colorMap[status] || 'bg-muted'}>
        {t(`status.${status}`, status)}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              {t('common.exportCSV')}
            </Button>
          </div>
        </DialogHeader>
        
        <ScrollArea className="h-[500px]">
          {data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.noData')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(col => (
                    <TableHead key={col.key as string}>{col.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((record) => (
                  <TableRow key={record.id}>
                    {columns.map(col => (
                      <TableCell key={col.key as string}>
                        {col.key === 'status' && record.status ? (
                          getStatusBadge(record.status)
                        ) : col.key === 'batch' && record.batch ? (
                          <Badge variant="outline">{record.batch}</Badge>
                        ) : (
                          record[col.key] || '-'
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
        
        <div className="text-sm text-muted-foreground text-center">
          {t('reports.showingRecords', { count: data.length })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
