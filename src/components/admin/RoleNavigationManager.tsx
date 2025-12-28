import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { SortableNavItem } from './SortableNavItem';
import { 
  LayoutDashboard, 
  Route, 
  CheckSquare, 
  FileText, 
  Calendar, 
  TrendingUp, 
  BarChart3, 
  Users, 
  Shield, 
  Store, 
  DollarSign,
  Save,
  Loader2,
  Star,
  Plus,
  Link as LinkIcon,
  ExternalLink,
  BookOpen,
  Video,
  MessageSquare,
  HelpCircle,
  Megaphone,
  Gift,
  Award,
  Target,
  GripVertical,
  Pencil,
  Trash2
} from 'lucide-react';
import type { AppRole } from '@/types/database';


interface NavigationSetting {
  id: string;
  role: AppRole;
  page_path: string;
  label_key: string;
  icon_name: string;
  is_visible: boolean;
  is_default: boolean;
  display_order: number;
  is_custom: boolean;
  custom_label: string | null;
  is_external: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Route,
  CheckSquare,
  FileText,
  Calendar,
  TrendingUp,
  BarChart3,
  Users,
  Shield,
  Store,
  DollarSign,
  LinkIcon,
  ExternalLink,
  BookOpen,
  Video,
  MessageSquare,
  HelpCircle,
  Megaphone,
  Gift,
  Award,
  Target,
  GripVertical,
};

const AVAILABLE_ICONS = [
  { name: 'LinkIcon', label: 'Link' },
  { name: 'ExternalLink', label: 'External Link' },
  { name: 'BookOpen', label: 'Book' },
  { name: 'Video', label: 'Video' },
  { name: 'MessageSquare', label: 'Message' },
  { name: 'HelpCircle', label: 'Help' },
  { name: 'Megaphone', label: 'Announcement' },
  { name: 'Gift', label: 'Gift' },
  { name: 'Award', label: 'Award' },
  { name: 'Target', label: 'Target' },
  { name: 'FileText', label: 'Document' },
  { name: 'Calendar', label: 'Calendar' },
  { name: 'BarChart3', label: 'Chart' },
];

const ALL_PAGES = [
  { path: '/dashboard', labelKey: 'sidebar.dashboard', icon: 'LayoutDashboard' },
  { path: '/journey', labelKey: 'sidebar.myJourney', icon: 'Route' },
  { path: '/tasks', labelKey: 'sidebar.tasks', icon: 'CheckSquare' },
  { path: '/documents', labelKey: 'sidebar.documents', icon: 'FileText' },
  { path: '/attendance', labelKey: 'sidebar.attendance', icon: 'Calendar' },
  { path: '/trades', labelKey: 'sidebar.tradeUpdates', icon: 'TrendingUp' },
  { path: '/coach', labelKey: 'sidebar.verification', icon: 'Users' },
  { path: '/ecommerce', labelKey: 'sidebar.ecommerce', icon: 'Store' },
  { path: '/finance', labelKey: 'sidebar.finance', icon: 'DollarSign' },
  { path: '/analytics', labelKey: 'sidebar.analytics', icon: 'BarChart3' },
  { path: '/admin', labelKey: 'sidebar.adminPanel', icon: 'Shield' },
];

const ROLES: AppRole[] = ['participant', 'coach', 'admin', 'ecommerce', 'finance'];

interface CustomLinkForm {
  label: string;
  url: string;
  icon: string;
  isExternal: boolean;
}

const RoleNavigationManager = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NavigationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('participant');
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<NavigationSetting>>>({});
  
  // Custom link dialog
  const [customLinkDialog, setCustomLinkDialog] = useState(false);
  const [editingLink, setEditingLink] = useState<NavigationSetting | null>(null);
  const [customLinkForm, setCustomLinkForm] = useState<CustomLinkForm>({
    label: '',
    url: '',
    icon: 'LinkIcon',
    isExternal: false,
  });
  const [savingCustom, setSavingCustom] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('role_navigation_settings')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setSettings((data as NavigationSetting[]) || []);
    } catch (error) {
      console.error('Error fetching navigation settings:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const getRoleSettings = (role: AppRole) => {
    return settings.filter(s => s.role === role);
  };

  const getCustomLinks = (role: AppRole) => {
    return settings.filter(s => s.role === role && s.is_custom);
  };

  const getSettingForPage = (role: AppRole, pagePath: string) => {
    return settings.find(s => s.role === role && s.page_path === pagePath);
  };

  const handleVisibilityChange = (role: AppRole, pagePath: string, isVisible: boolean) => {
    const existing = getSettingForPage(role, pagePath);
    const key = `${role}-${pagePath}`;
    
    if (existing) {
      const updates: Partial<NavigationSetting> = { is_visible: isVisible };
      if (!isVisible && existing.is_default) {
        updates.is_default = false;
      }
      
      setPendingChanges(prev => ({
        ...prev,
        [key]: { ...prev[key], ...updates, id: existing.id }
      }));
      
      setSettings(prev => prev.map(s => 
        s.id === existing.id ? { ...s, ...updates } : s
      ));
    } else {
      const pageInfo = ALL_PAGES.find(p => p.path === pagePath);
      if (pageInfo) {
        const newSetting: NavigationSetting = {
          id: `new-${key}`,
          role,
          page_path: pagePath,
          label_key: pageInfo.labelKey,
          icon_name: pageInfo.icon,
          is_visible: isVisible,
          is_default: false,
          display_order: ALL_PAGES.findIndex(p => p.path === pagePath) + 1,
          is_custom: false,
          custom_label: null,
          is_external: false,
        };
        
        setPendingChanges(prev => ({
          ...prev,
          [key]: { ...newSetting, id: undefined }
        }));
        
        setSettings(prev => [...prev, newSetting]);
      }
    }
  };

  const handleDefaultChange = (role: AppRole, pagePath: string) => {
    const roleSettings = getRoleSettings(role);
    const targetSetting = getSettingForPage(role, pagePath);
    
    if (!targetSetting?.is_visible) {
      toast.error(t('admin.mustBeVisibleForDefault'));
      return;
    }
    
    roleSettings.forEach(s => {
      if (s.is_default && s.page_path !== pagePath) {
        const key = `${role}-${s.page_path}`;
        setPendingChanges(prev => ({
          ...prev,
          [key]: { ...prev[key], is_default: false, id: s.id }
        }));
      }
    });
    
    const key = `${role}-${pagePath}`;
    setPendingChanges(prev => ({
      ...prev,
      [key]: { ...prev[key], is_default: true, id: targetSetting.id }
    }));
    
    setSettings(prev => prev.map(s => ({
      ...s,
      is_default: s.role === role ? s.page_path === pagePath : s.is_default
    })));
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      for (const [key, changes] of Object.entries(pendingChanges)) {
        const [role, ...pathParts] = key.split('-');
        const pagePath = '/' + pathParts.join('-');
        
        if (changes.id && !changes.id.startsWith('new-')) {
          const { error } = await supabase
            .from('role_navigation_settings')
            .update({
              is_visible: changes.is_visible,
              is_default: changes.is_default
            })
            .eq('id', changes.id);
          
          if (error) throw error;
        } else {
          const pageInfo = ALL_PAGES.find(p => p.path === pagePath);
          if (pageInfo) {
            const { error } = await supabase
              .from('role_navigation_settings')
              .insert({
                role: role as AppRole,
                page_path: pagePath,
                label_key: pageInfo.labelKey,
                icon_name: pageInfo.icon,
                is_visible: changes.is_visible ?? true,
                is_default: changes.is_default ?? false,
                display_order: ALL_PAGES.findIndex(p => p.path === pagePath) + 1,
                is_custom: false,
                is_external: false,
              });
            
            if (error) throw error;
          }
        }
      }
      
      toast.success(t('admin.navigationSettingsSaved'));
      setPendingChanges({});
      fetchSettings();
    } catch (error) {
      console.error('Error saving navigation settings:', error);
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const openAddCustomLink = () => {
    setEditingLink(null);
    setCustomLinkForm({
      label: '',
      url: '',
      icon: 'LinkIcon',
      isExternal: false,
    });
    setCustomLinkDialog(true);
  };

  const openEditCustomLink = (link: NavigationSetting) => {
    setEditingLink(link);
    setCustomLinkForm({
      label: link.custom_label || '',
      url: link.page_path,
      icon: link.icon_name,
      isExternal: link.is_external,
    });
    setCustomLinkDialog(true);
  };

  const saveCustomLink = async () => {
    if (!customLinkForm.label.trim() || !customLinkForm.url.trim()) {
      toast.error(t('admin.fillRequiredFields'));
      return;
    }

    setSavingCustom(true);
    try {
      const maxOrder = Math.max(...getRoleSettings(selectedRole).map(s => s.display_order), 0);
      
      if (editingLink) {
        const { error } = await supabase
          .from('role_navigation_settings')
          .update({
            page_path: customLinkForm.url,
            custom_label: customLinkForm.label,
            icon_name: customLinkForm.icon,
            is_external: customLinkForm.isExternal,
          })
          .eq('id', editingLink.id);
        
        if (error) throw error;
        toast.success(t('admin.customLinkUpdated'));
      } else {
        const { error } = await supabase
          .from('role_navigation_settings')
          .insert({
            role: selectedRole,
            page_path: customLinkForm.url,
            label_key: 'custom',
            custom_label: customLinkForm.label,
            icon_name: customLinkForm.icon,
            is_visible: true,
            is_default: false,
            display_order: maxOrder + 1,
            is_custom: true,
            is_external: customLinkForm.isExternal,
          });
        
        if (error) throw error;
        toast.success(t('admin.customLinkCreated'));
      }
      
      setCustomLinkDialog(false);
      fetchSettings();
    } catch (error) {
      console.error('Error saving custom link:', error);
      toast.error(t('common.error'));
    } finally {
      setSavingCustom(false);
    }
  };

  const deleteCustomLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('role_navigation_settings')
        .delete()
        .eq('id', linkId);
      
      if (error) throw error;
      toast.success(t('admin.customLinkDeleted'));
      fetchSettings();
    } catch (error) {
      console.error('Error deleting custom link:', error);
      toast.error(t('common.error'));
    }
  };

  const toggleCustomLinkVisibility = async (link: NavigationSetting) => {
    try {
      const { error } = await supabase
        .from('role_navigation_settings')
        .update({ is_visible: !link.is_visible })
        .eq('id', link.id);
      
      if (error) throw error;
      fetchSettings();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error(t('common.error'));
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'coach': return 'default';
      case 'ecommerce': return 'secondary';
      case 'finance': return 'outline';
      default: return 'outline';
    }
  };

  // Get all navigation items for a role in display order
  const getAllNavItems = (role: AppRole) => {
    const roleSettings = getRoleSettings(role);
    const existingPaths = new Set(roleSettings.map(s => s.page_path));
    
    // Create items for all system pages (even if not in settings yet)
    const systemItems = ALL_PAGES.map((page, index) => {
      const setting = getSettingForPage(role, page.path);
      return {
        id: setting?.id || `system-${role}-${page.path}`,
        page_path: page.path,
        label_key: page.labelKey,
        icon_name: page.icon,
        is_visible: setting?.is_visible ?? false,
        is_default: setting?.is_default ?? false,
        display_order: setting?.display_order ?? (index + 1),
        is_custom: false,
        custom_label: null,
        is_external: false,
        role,
      } as NavigationSetting;
    });

    // Get custom links
    const customItems = getCustomLinks(role);

    // Combine and sort by display_order
    return [...systemItems, ...customItems].sort((a, b) => a.display_order - b.display_order);
  };

  const handleDragEnd = async (event: DragEndEvent, role: AppRole) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const items = getAllNavItems(role);
    const oldIndex = items.findIndex(item => item.id === active.id);
    const newIndex = items.findIndex(item => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedItems = arrayMove(items, oldIndex, newIndex);
    
    // Update display_order for all items
    const updates = reorderedItems.map((item, index) => ({
      ...item,
      display_order: index + 1,
    }));

    // Update local state immediately
    setSettings(prev => {
      const otherRoleSettings = prev.filter(s => s.role !== role);
      return [...otherRoleSettings, ...updates.filter(u => !u.id.startsWith('system-'))];
    });

    // Save to database
    try {
      for (const item of updates) {
        if (item.id.startsWith('system-')) {
          // Create new setting for system page
          const pageInfo = ALL_PAGES.find(p => p.path === item.page_path);
          if (pageInfo) {
            await supabase.from('role_navigation_settings').insert({
              role: item.role,
              page_path: item.page_path,
              label_key: pageInfo.labelKey,
              icon_name: pageInfo.icon,
              is_visible: item.is_visible,
              is_default: item.is_default,
              display_order: item.display_order,
              is_custom: false,
              is_external: false,
            });
          }
        } else {
          await supabase
            .from('role_navigation_settings')
            .update({ display_order: item.display_order })
            .eq('id', item.id);
        }
      }
      toast.success(t('admin.orderSaved'));
      fetchSettings();
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error(t('common.error'));
      fetchSettings();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px]" />
        </CardContent>
      </Card>
    );
  }

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('admin.roleNavigation')}
              </CardTitle>
              <CardDescription>{t('admin.roleNavigationDesc')}</CardDescription>
            </div>
            <div className="flex gap-2">
              {hasPendingChanges && (
                <Button onClick={saveChanges} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {t('common.saveChanges')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
            <TabsList className="mb-4 flex-wrap h-auto">
              {ROLES.map(role => (
                <TabsTrigger key={role} value={role} className="capitalize">
                  <Badge variant={getRoleBadgeVariant(role)} className="mr-2">
                    {role}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {ROLES.map(role => {
              const navItems = getAllNavItems(role);
              const systemItems = navItems.filter(item => !item.is_custom);
              const customItems = navItems.filter(item => item.is_custom);
              
              return (
                <TabsContent key={role} value={role} className="space-y-6">
                  {/* All Navigation Items with Drag & Drop */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold">{t('admin.navigationItems')}</h3>
                        <p className="text-xs text-muted-foreground">{t('admin.dragToReorder')}</p>
                      </div>
                      <Button size="sm" onClick={openAddCustomLink}>
                        <Plus className="h-4 w-4 mr-1" />
                        {t('admin.addCustomLink')}
                      </Button>
                    </div>
                    
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(event, role)}
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead className="w-12">{t('admin.icon')}</TableHead>
                            <TableHead>{t('admin.page')}</TableHead>
                            <TableHead className="text-center">{t('admin.visible')}</TableHead>
                            <TableHead className="text-center">{t('admin.defaultPage')}</TableHead>
                            <TableHead className="w-24">{t('coach.actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <SortableContext
                            items={navItems.map(item => item.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {navItems.map(item => {
                              const IconComponent = iconMap[item.icon_name] || LayoutDashboard;
                              const isCustom = item.is_custom;
                              
                              return (
                                <SortableNavItem
                                  key={item.id}
                                  id={item.id}
                                  icon={<IconComponent className="h-4 w-4 text-muted-foreground" />}
                                  label={isCustom ? (item.custom_label || '') : t(item.label_key)}
                                  path={item.page_path}
                                  isVisible={item.is_visible}
                                  isDefault={item.is_default}
                                  isCustom={isCustom}
                                  isExternal={item.is_external}
                                  onVisibilityChange={(visible) => {
                                    if (isCustom) {
                                      toggleCustomLinkVisibility(item);
                                    } else {
                                      handleVisibilityChange(role, item.page_path, visible);
                                    }
                                  }}
                                  onDefaultChange={() => handleDefaultChange(role, item.page_path)}
                                  onEdit={isCustom ? () => openEditCustomLink(item) : undefined}
                                  onDelete={isCustom ? () => deleteCustomLink(item.id) : undefined}
                                />
                              );
                            })}
                          </SortableContext>
                        </TableBody>
                      </Table>
                    </DndContext>
                  </div>

                  {/* Default Page Info */}
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>{t('admin.defaultPage')}:</strong>{' '}
                      {getRoleSettings(role).find(s => s.is_default)?.page_path || t('common.notSet')}
                    </p>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Custom Link Dialog */}
      <Dialog open={customLinkDialog} onOpenChange={setCustomLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLink ? t('admin.editCustomLink') : t('admin.addCustomLink')}
            </DialogTitle>
            <DialogDescription>
              {t('admin.customLinkDesc')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="link-label">{t('admin.label')} *</Label>
              <Input
                id="link-label"
                value={customLinkForm.label}
                onChange={(e) => setCustomLinkForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder={t('admin.customLinkLabelPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link-url">{t('admin.url')} *</Label>
              <Input
                id="link-url"
                value={customLinkForm.url}
                onChange={(e) => setCustomLinkForm(prev => ({ ...prev, url: e.target.value }))}
                placeholder={customLinkForm.isExternal ? "https://example.com" : "/custom-page"}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('admin.selectIcon')}</Label>
              <Select
                value={customLinkForm.icon}
                onValueChange={(v) => setCustomLinkForm(prev => ({ ...prev, icon: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ICONS.map(icon => {
                    const IconComponent = iconMap[icon.name];
                    return (
                      <SelectItem key={icon.name} value={icon.name}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          {icon.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="is-external"
                checked={customLinkForm.isExternal}
                onCheckedChange={(checked) => setCustomLinkForm(prev => ({ ...prev, isExternal: checked }))}
              />
              <Label htmlFor="is-external" className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                {t('admin.externalLink')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('admin.externalLinkHint')}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomLinkDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveCustomLink} disabled={savingCustom}>
              {savingCustom && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLink ? t('common.save') : t('admin.addLink')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RoleNavigationManager;
