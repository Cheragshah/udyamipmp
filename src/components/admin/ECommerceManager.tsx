import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Store, Plus, ExternalLink, Search, CheckCircle, Edit, Loader2 } from 'lucide-react';
import { formatLocalizedDate } from '@/lib/formatters';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  batch_number?: string | null;
}

interface ECommerceSetup {
  id: string;
  user_id: string;
  store_name: string | null;
  store_url: string | null;
  platform: string | null;
  store_details: string | null;
  status: string;
  created_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

const PLATFORMS = ['amazon', 'flipkart', 'own_website', 'shopify', 'indiamart', 'other'];

const ECommerceManager = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [setups, setSetups] = useState<ECommerceSetup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSetup, setEditSetup] = useState<ECommerceSetup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [platform, setPlatform] = useState('');
  const [storeDetails, setStoreDetails] = useState('');
  const [notes, setNotes] = useState('');

  const locale = i18n.language;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profilesRes, setupsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, batch_number'),
        supabase.from('ecommerce_setups').select('*').order('created_at', { ascending: false })
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (setupsRes.error) throw setupsRes.error;

      setProfiles(profilesRes.data || []);
      
      const enrichedSetups = (setupsRes.data || []).map(setup => ({
        ...setup,
        user_name: profilesRes.data?.find(p => p.id === setup.user_id)?.full_name || 'Unknown'
      }));
      
      setSetups(enrichedSetups);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedUserId('');
    setStoreName('');
    setStoreUrl('');
    setPlatform('');
    setStoreDetails('');
    setNotes('');
    setEditSetup(null);
  };

  const openAddDialog = (userId?: string) => {
    resetForm();
    if (userId) setSelectedUserId(userId);
    setDialogOpen(true);
  };

  const openEditDialog = (setup: ECommerceSetup) => {
    setEditSetup(setup);
    setSelectedUserId(setup.user_id);
    setStoreName(setup.store_name || '');
    setStoreUrl(setup.store_url || '');
    setPlatform(setup.platform || '');
    setStoreDetails(setup.store_details || '');
    setNotes(setup.notes || '');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedUserId || !storeName || !platform) {
      toast.error(t('admin.fillRequiredFields'));
      return;
    }

    setSubmitting(true);
    try {
      if (editSetup) {
        const { error } = await supabase
          .from('ecommerce_setups')
          .update({
            store_name: storeName,
            store_url: storeUrl || null,
            platform,
            store_details: storeDetails || null,
            notes: notes || null
          })
          .eq('id', editSetup.id);

        if (error) throw error;
        toast.success(t('ecommerce.setupUpdated'));
      } else {
        const { error } = await supabase
          .from('ecommerce_setups')
          .insert({
            user_id: selectedUserId,
            store_name: storeName,
            store_url: storeUrl || null,
            platform,
            store_details: storeDetails || null,
            notes: notes || null,
            created_by: user?.id
          });

        if (error) throw error;
        toast.success(t('ecommerce.setupCreated'));
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving setup:', error);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const markAsCompleted = async (setupId: string) => {
    try {
      const { error } = await supabase
        .from('ecommerce_setups')
        .update({
          status: 'completed',
          completed_by: user?.id,
          completed_at: new Date().toISOString()
        })
        .eq('id', setupId);

      if (error) throw error;
      toast.success(t('ecommerce.markedComplete'));
      fetchData();
    } catch (error) {
      console.error('Error marking complete:', error);
      toast.error(t('common.error'));
    }
  };

  const reopenSetup = async (setupId: string) => {
    try {
      const { error } = await supabase
        .from('ecommerce_setups')
        .update({
          status: 'in_progress',
          completed_by: null,
          completed_at: null
        })
        .eq('id', setupId);

      if (error) throw error;
      toast.success(t('admin.reopened'));
      fetchData();
    } catch (error) {
      console.error('Error reopening:', error);
      toast.error(t('common.error'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 text-white">{t('common.completed')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500 text-white">{t('common.inProgress')}</Badge>;
      default:
        return <Badge variant="secondary">{t('common.notStarted')}</Badge>;
    }
  };

  const filteredSetups = setups.filter(setup => {
    const search = searchTerm.toLowerCase();
    return !search || 
      setup.user_name?.toLowerCase().includes(search) ||
      setup.store_name?.toLowerCase().includes(search) ||
      setup.platform?.toLowerCase().includes(search);
  });

  // Users without setups
  const usersWithoutSetups = profiles.filter(
    p => !setups.some(s => s.user_id === p.id)
  );

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              <div>
                <CardTitle>{t('ecommerce.title')}</CardTitle>
                <CardDescription>{t('ecommerce.subtitle')}</CardDescription>
              </div>
            </div>
            <Button onClick={() => openAddDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              {t('ecommerce.addSetup')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('ecommerce.searchSetups')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredSetups.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('ecommerce.noSetups')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('coach.participant')}</TableHead>
                  <TableHead>{t('ecommerce.storeName')}</TableHead>
                  <TableHead>{t('ecommerce.platform')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('coach.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSetups.map((setup) => (
                  <TableRow key={setup.id}>
                    <TableCell className="font-medium">{setup.user_name}</TableCell>
                    <TableCell>
                      {setup.store_url ? (
                        <a 
                          href={setup.store_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          {setup.store_name}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        setup.store_name || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{setup.platform}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(setup.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(setup)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {setup.status !== 'completed' ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => markAsCompleted(setup.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            {t('ecommerce.markComplete')}
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => reopenSetup(setup.id)}
                          >
                            {t('admin.reopen')}
                          </Button>
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

      {/* Users without setups */}
      {usersWithoutSetups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('ecommerce.usersWithoutSetup')}</CardTitle>
            <CardDescription>{t('ecommerce.usersWithoutSetupDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.name')}</TableHead>
                  <TableHead>{t('admin.email')}</TableHead>
                  <TableHead>{t('admin.batchNumber')}</TableHead>
                  <TableHead>{t('coach.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersWithoutSetups.slice(0, 10).map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.full_name || t('common.na')}</TableCell>
                    <TableCell>{profile.email || '-'}</TableCell>
                    <TableCell>{profile.batch_number || '-'}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => openAddDialog(profile.id)}>
                        <Plus className="h-4 w-4 mr-1" />
                        {t('ecommerce.addSetup')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editSetup ? t('ecommerce.editSetup') : t('ecommerce.addSetup')}
            </DialogTitle>
            <DialogDescription>
              {t('ecommerce.setupDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('admin.selectParticipant')}</label>
              <Select 
                value={selectedUserId} 
                onValueChange={setSelectedUserId}
                disabled={!!editSetup}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.selectParticipant')} />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">{t('ecommerce.storeName')} *</label>
              <Input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder={t('ecommerce.storeNamePlaceholder')}
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t('ecommerce.platform')} *</label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder={t('ecommerce.selectPlatform')} />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p} value={p}>
                      {t(`ecommerce.platforms.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">{t('ecommerce.storeUrl')}</label>
              <Input
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t('ecommerce.storeDetails')}</label>
              <Textarea
                value={storeDetails}
                onChange={(e) => setStoreDetails(e.target.value)}
                placeholder={t('ecommerce.storeDetailsPlaceholder')}
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t('admin.notes')}</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('coach.addNotes')}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editSetup ? t('ecommerce.updateSetup') : t('ecommerce.createSetup')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ECommerceManager;
