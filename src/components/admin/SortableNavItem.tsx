import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';

interface SortableNavItemProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  path: string;
  isVisible: boolean;
  isDefault: boolean;
  isCustom?: boolean;
  isExternal?: boolean;
  onVisibilityChange: (visible: boolean) => void;
  onDefaultChange: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const SortableNavItem = ({
  id,
  icon,
  label,
  path,
  isVisible,
  isDefault,
  isCustom = false,
  isExternal = false,
  onVisibilityChange,
  onDefaultChange,
  onEdit,
  onDelete,
}: SortableNavItemProps) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isCustom) {
    return (
      <TableRow ref={setNodeRef} style={style}>
        <TableCell>
          <button
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </TableCell>
        <TableCell>{icon}</TableCell>
        <TableCell className="font-medium">{label}</TableCell>
        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
          {path}
        </TableCell>
        <TableCell className="text-center">
          {isExternal ? (
            <Badge variant="outline" className="text-xs">
              <ExternalLink className="h-3 w-3 mr-1" />
              {t('admin.external')}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              {t('admin.internal')}
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-center">
          <Switch
            checked={isVisible}
            onCheckedChange={onVisibilityChange}
          />
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('admin.confirmDelete')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('admin.deleteCustomLinkConfirm')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>
                    {t('admin.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <button
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>{icon}</TableCell>
      <TableCell className="font-medium">
        {label}
        <span className="text-xs text-muted-foreground ml-2">{path}</span>
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={isVisible}
          onCheckedChange={onVisibilityChange}
        />
      </TableCell>
      <TableCell className="text-center">
        <Button
          variant={isDefault ? "default" : "ghost"}
          size="sm"
          onClick={onDefaultChange}
          disabled={!isVisible}
          className={isDefault ? "" : "text-muted-foreground"}
        >
          <Star className={`h-4 w-4 ${isDefault ? "fill-current" : ""}`} />
        </Button>
      </TableCell>
    </TableRow>
  );
};
