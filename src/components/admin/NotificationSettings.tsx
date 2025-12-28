import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Mail, MessageSquare, Save, Loader2, Shield, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface NotificationSettingsData {
  email_notifications_enabled: boolean;
  whatsapp_notifications_enabled: boolean;
}

export default function NotificationSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState<NotificationSettingsData>({
    email_notifications_enabled: false,
    whatsapp_notifications_enabled: false
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('email_notifications_enabled, whatsapp_notifications_enabled')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSettings({
          email_notifications_enabled: data.email_notifications_enabled || false,
          whatsapp_notifications_enabled: data.whatsapp_notifications_enabled || false
        });
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // First check if app_settings row exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({
            email_notifications_enabled: settings.email_notifications_enabled,
            whatsapp_notifications_enabled: settings.whatsapp_notifications_enabled
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({
            email_notifications_enabled: settings.email_notifications_enabled,
            whatsapp_notifications_enabled: settings.whatsapp_notifications_enabled
          });

        if (error) throw error;
      }

      toast.success(t('admin.notificationSettingsSaved'));
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {t('admin.notificationSettings')}
        </CardTitle>
        <CardDescription>{t('admin.notificationSettingsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Security Notice */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            {t('admin.apiKeysSecurityNotice')}
          </AlertDescription>
        </Alert>

        {/* Email Notifications Section */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{t('admin.emailNotifications')}</p>
                <p className="text-sm text-muted-foreground">{t('admin.emailNotificationsDesc')}</p>
              </div>
            </div>
            <Switch
              checked={settings.email_notifications_enabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, email_notifications_enabled: checked }))}
            />
          </div>
          
          <div className="bg-muted/50 p-3 rounded-md">
            <p className="text-sm text-muted-foreground">
              {t('admin.resendApiKeySecure')}
            </p>
            <a 
              href="https://resend.com/api-keys" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
            >
              {t('admin.getResendKey')} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* WhatsApp Notifications Section */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-success" />
              <div>
                <p className="font-medium">{t('admin.whatsappNotifications')}</p>
                <p className="text-sm text-muted-foreground">{t('admin.whatsappNotificationsDesc')}</p>
              </div>
            </div>
            <Switch
              checked={settings.whatsapp_notifications_enabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, whatsapp_notifications_enabled: checked }))}
            />
          </div>
          
          <div className="bg-muted/50 p-3 rounded-md">
            <p className="text-sm text-muted-foreground">
              {t('admin.whatsappApiKeySecure')}
            </p>
          </div>
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('common.saving')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t('admin.saveNotificationSettings')}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
