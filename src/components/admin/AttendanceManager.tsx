import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Search, Plus, Trash2, CalendarIcon, CheckCircle2, Users, History, BarChart3 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';
import BulkAttendanceManager from './BulkAttendanceManager';
import AttendanceReports from './AttendanceReports';

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  attendance_type: string;
  session_name: string | null;
  check_in_time: string;
  user_name?: string;
}

interface Session {
  id: string;
  name: string;
  session_type: string;
  is_active: boolean;
}

export default function AttendanceManager() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Tables<'profiles'>[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [markDialog, setMarkDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendanceType, setAttendanceType] = useState<string>('daily');
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('bulk');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [{ data: profilesData }, { data: sessionsData }, { data: attendanceData }] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('sessions').select('*').eq('is_active', true),
        supabase.from('attendance').select('*').order('date', { ascending: false }).limit(100)
      ]);

      if (profilesData) setParticipants(profilesData);
      if (sessionsData) setSessions(sessionsData);

      if (attendanceData && profilesData) {
        const enriched = attendanceData.map(a => ({
          ...a,
          user_name: profilesData.find(p => p.id === a.user_id)?.full_name || 'Unknown'
        }));
        setAttendanceRecords(enriched);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async () => {
    if (!selectedParticipant) {
      toast.error(t('admin.selectParticipant'));
      return;
    }

    if (attendanceType === 'session' && !selectedSession) {
      toast.error(t('admin.selectSession'));
      return;
    }

    setSubmitting(true);
    try {
      const sessionName = attendanceType === 'session' 
        ? sessions.find(s => s.id === selectedSession)?.name 
        : null;

      const { error } = await supabase.from('attendance').insert({
        user_id: selectedParticipant,
        date: format(selectedDate, 'yyyy-MM-dd'),
        attendance_type: attendanceType,
        session_name: sessionName,
        check_in_time: new Date().toISOString()
      });

      if (error) throw error;

      toast.success(t('admin.attendanceMarked'));
      setMarkDialog(false);
      setSelectedParticipant('');
      setAttendanceType('daily');
      setSelectedSession('');
      fetchData();
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      toast.error(error.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', id);
      if (error) throw error;
      toast.success(t('admin.attendanceDeleted'));
      fetchData();
    } catch (error) {
      console.error('Error deleting attendance:', error);
      toast.error(t('common.error'));
    }
  };

  const filteredRecords = attendanceRecords.filter(r => {
    const searchLower = search.toLowerCase();
    return !search || 
      r.user_name?.toLowerCase().includes(searchLower) ||
      r.session_name?.toLowerCase().includes(searchLower);
  });

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('admin.bulkAttendance')}
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t('admin.reports')}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('admin.attendanceHistory')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bulk" className="mt-4">
          <BulkAttendanceManager />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <AttendanceReports />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>{t('admin.attendanceHistory')}</CardTitle>
                  <CardDescription>{t('admin.viewAttendanceRecords')}</CardDescription>
                </div>
                <Button onClick={() => setMarkDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('admin.markAttendance')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('admin.searchAttendance')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('admin.noAttendanceRecords')}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.participant')}</TableHead>
                      <TableHead>{t('admin.date')}</TableHead>
                      <TableHead>{t('admin.type')}</TableHead>
                      <TableHead>{t('admin.session')}</TableHead>
                      <TableHead>{t('coach.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.user_name}</TableCell>
                        <TableCell>{format(parseISO(record.date), 'PP')}</TableCell>
                        <TableCell>
                          <Badge variant={record.attendance_type === 'daily' ? 'default' : 'secondary'}>
                            {record.attendance_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.session_name || '-'}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteAttendance(record.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mark Attendance Dialog */}
      <Dialog open={markDialog} onOpenChange={setMarkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.markAttendance')}</DialogTitle>
            <DialogDescription>{t('admin.markAttendanceDescription')}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.selectParticipant')}</label>
              <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.selectParticipant')} />
                </SelectTrigger>
                <SelectContent>
                  {participants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.date')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.attendanceType')}</label>
              <Select value={attendanceType} onValueChange={setAttendanceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t('attendance.daily')}</SelectItem>
                  <SelectItem value="session">{t('attendance.session')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {attendanceType === 'session' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('admin.selectSession')}</label>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.selectSession')} />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleMarkAttendance} disabled={submitting}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t('admin.markAttendance')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
