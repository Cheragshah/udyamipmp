import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Link as LinkIcon, ExternalLink, Loader2, CheckCircle, Users, Lock } from 'lucide-react';
import { formatLocalizedDate } from '@/lib/formatters';

interface SpecialSessionLink {
  id: string;
  title: string;
  description: string | null;
  link_url: string;
  session_type: string;
  target_batch: string | null;
  is_active: boolean;
  is_completed: boolean;
  created_at: string;
}

export default function LinksManagement() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const locale = i18n.language;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState<SpecialSessionLink[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<SpecialSessionLink | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link_url: '',
    session_type: 'special_session',
    target_batch: 'all',
    is_active: true
  });

  const fetchData = async () => {
    try {
      const [linksRes, profilesRes] = await Promise.all([
        supabase.from('special_session_links').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('batch_number').not('batch_number', 'is', null)
      ]);

      setLinks(linksRes.data || []);
      
      // Get unique batch numbers
      const uniqueBatches = [...new Set((profilesRes.data || []).map(p => p.batch_number).filter(Boolean))];
      setBatches(uniqueBatches as string[]);
    } catch (error) {
      console.error('Error fetching links:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenDialog = (link?: SpecialSessionLink) => {
    if (link) {
      setEditingLink(link);
      setFormData({
        title: link.title,
        description: link.description || '',
        link_url: link.link_url,
        session_type: link.session_type,
        target_batch: link.target_batch || 'all',
        is_active: link.is_active
      });
    } else {
      setEditingLink(null);
      setFormData({
        title: '',
        description: '',
        link_url: '',
        session_type: 'special_session',
        target_batch: 'all',
        is_active: true
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.link_url) {
      toast.error(t('admin.fillRequiredFields'));
      return;
    }

    setSaving(true);
    try {
      const data = {
        title: formData.title,
        description: formData.description || null,
        link_url: formData.link_url,
        session_type: formData.session_type,
        target_batch: formData.target_batch === 'all' ? null : formData.target_batch,
        is_active: formData.is_active,
        created_by: user?.id
      };

      if (editingLink) {
        await supabase.from('special_session_links').update(data).eq('id', editingLink.id);
        toast.success(t('admin.linkUpdated'));
      } else {
        await supabase.from('special_session_links').insert(data);
        toast.success(t('admin.linkCreated'));
      }

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving link:', error);
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('special_session_links').delete().eq('id', id);
      toast.success(t('admin.linkDeleted'));
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting link:', error);
      toast.error(t('common.error'));
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await supabase.from('special_session_links').update({ is_active: isActive }).eq('id', id);
      toast.success(isActive ? t('admin.linkActivated') : t('admin.linkDeactivated'));
      fetchData();
    } catch (error) {
      console.error('Error toggling link:', error);
      toast.error(t('common.error'));
    }
  };

  const handleMarkCompleteForAll = async (link: SpecialSessionLink) => {
    setMarkingComplete(link.id);
    try {
      // Fetch users based on target batch
      let query = supabase.from('profiles').select('id');
      if (link.target_batch) {
        query = query.eq('batch_number', link.target_batch);
      }
      const { data: users, error: usersError } = await query;
      
      if (usersError) throw usersError;
      if (!users || users.length === 0) {
        toast.info(t('admin.noUsersFound'));
        return;
      }

      // Map session_type to stage name for participant_progress update
      const sessionTypeToStageName: Record<string, string> = {
        'special_session': 'Special Session',
        'offline_orientation': 'Offline Orientation',
        'online_orientation': 'Online Orientation',
        'ohm_meet': 'OHM Offline Meet',
      };

      // Fetch the corresponding stage
      const stageName = sessionTypeToStageName[link.session_type];
      let stageId: string | null = null;
      
      if (stageName) {
        const { data: stageData } = await supabase
          .from('journey_stages')
          .select('id')
          .eq('name', stageName)
          .single();
        stageId = stageData?.id || null;
      }

      // Create completion records for all users
      const completions = users.map(u => ({
        user_id: u.id,
        session_type: link.session_type,
        notes: `Marked complete for session: ${link.title}`,
        marked_by: user?.id
      }));

      // Delete existing completions for this session type to avoid duplicates
      await supabase
        .from('user_session_completions')
        .delete()
        .eq('session_type', link.session_type)
        .in('user_id', users.map(u => u.id));

      // Insert new completions
      const { error } = await supabase.from('user_session_completions').insert(completions);
      if (error) throw error;

      // Also update participant_progress for the corresponding stage
      if (stageId) {
        for (const u of users) {
          // Check if progress record exists
          const { data: existingProgress } = await supabase
            .from('participant_progress')
            .select('id')
            .eq('user_id', u.id)
            .eq('stage_id', stageId)
            .single();

          if (existingProgress) {
            // Update existing record
            await supabase
              .from('participant_progress')
              .update({ 
                status: 'completed', 
                completed_at: new Date().toISOString() 
              })
              .eq('id', existingProgress.id);
          } else {
            // Insert new record
            await supabase
              .from('participant_progress')
              .insert({
                user_id: u.id,
                stage_id: stageId,
                status: 'completed',
                started_at: new Date().toISOString(),
                completed_at: new Date().toISOString()
              });
          }
        }
      }

      // Mark the link as completed and inactive
      await supabase
        .from('special_session_links')
        .update({ is_completed: true, is_active: false })
        .eq('id', link.id);

      toast.success(t('admin.markedCompleteForAll', { count: users.length }));
      fetchData();
    } catch (error) {
      console.error('Error marking complete for all:', error);
      toast.error(t('common.error'));
    } finally {
      setMarkingComplete(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                {t('admin.specialSessionLinks')}
              </CardTitle>
              <CardDescription>{t('admin.manageSpecialSessionLinks')}</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              {t('admin.addLink')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('admin.noLinksYet')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.linkTitle')}</TableHead>
                  <TableHead>{t('admin.sessionType')}</TableHead>
                  <TableHead>{t('admin.targetBatch')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('admin.created')}</TableHead>
                  <TableHead>{t('coach.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map(link => (
                  <TableRow key={link.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{link.title}</p>
                        {link.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">{link.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{link.session_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {link.target_batch ? (
                        <Badge>{link.target_batch}</Badge>
                      ) : (
                        <Badge variant="secondary">{t('admin.allBatches')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {link.is_completed ? (
                        <Badge variant="secondary" className="bg-success/20 text-success">
                          <Lock className="h-3 w-3 mr-1" />
                          {t('admin.completed')}
                        </Badge>
                      ) : (
                        <Switch
                          checked={link.is_active}
                          onCheckedChange={(checked) => handleToggleActive(link.id, checked)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatLocalizedDate(link.created_at, 'PP', locale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {!link.is_completed && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleMarkCompleteForAll(link)}
                            disabled={markingComplete === link.id}
                            title={t('admin.markCompleteForAllUsers')}
                          >
                            {markingComplete === link.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                <Users className="h-4 w-4" />
                              </>
                            )}
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" asChild>
                          <a href={link.link_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        {!link.is_completed && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => handleOpenDialog(link)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm(link.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLink ? t('admin.editLink') : t('admin.addNewLink')}
            </DialogTitle>
            <DialogDescription>
              {t('admin.linkFormDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t('admin.linkTitle')} *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder={t('admin.linkTitlePlaceholder')}
              />
            </div>

            <div>
              <Label>{t('admin.linkUrl')} *</Label>
              <Input
                value={formData.link_url}
                onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div>
              <Label>{t('admin.description')}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('admin.descriptionPlaceholder')}
                rows={2}
              />
            </div>

            <div>
              <Label>{t('admin.sessionType')}</Label>
              <Select
                value={formData.session_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, session_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="special_session">Special Session</SelectItem>
                  <SelectItem value="offline_orientation">Offline Orientation</SelectItem>
                  <SelectItem value="online_orientation">Online Orientation</SelectItem>
                  <SelectItem value="ohm_meet">OHM Meet</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('admin.targetBatch')}</Label>
              <Select
                value={formData.target_batch}
                onValueChange={(value) => setFormData(prev => ({ ...prev, target_batch: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.allBatches')}</SelectItem>
                  {batches.map(batch => (
                    <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>{t('admin.activeLink')}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLink ? t('admin.updateLink') : t('admin.createLink')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.confirmDelete')}</DialogTitle>
            <DialogDescription>
              {t('admin.deleteConfirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              {t('admin.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
