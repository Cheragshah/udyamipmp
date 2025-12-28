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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Search, CalendarIcon, CheckCircle2, Users, Loader2, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

interface Session {
  id: string;
  name: string;
  session_type: string;
  is_active: boolean;
}

interface ParticipantWithAttendance extends Tables<'profiles'> {
  hasAttendanceToday: boolean;
}

export default function BulkAttendanceManager() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const [participants, setParticipants] = useState<ParticipantWithAttendance[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendanceType, setAttendanceType] = useState<string>('daily');
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Get unique batches
  const batches = [...new Set(participants.map(p => p.batch_number).filter(Boolean))].sort() as string[];

  useEffect(() => {
    fetchData();
  }, [user, role, selectedDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch profiles based on role
      let profilesQuery = supabase.from('profiles').select('*').order('full_name');
      
      if (role === 'coach') {
        profilesQuery = profilesQuery.eq('assigned_coach_id', user?.id);
      }

      const [{ data: profilesData }, { data: sessionsData }, { data: attendanceData }] = await Promise.all([
        profilesQuery,
        supabase.from('sessions').select('*').eq('is_active', true),
        supabase.from('attendance')
          .select('user_id, date, attendance_type')
          .eq('date', format(selectedDate, 'yyyy-MM-dd'))
          .eq('attendance_type', 'daily')
      ]);

      if (sessionsData) setSessions(sessionsData);

      if (profilesData) {
        const attendedUserIds = new Set((attendanceData || []).map(a => a.user_id));
        const enriched = profilesData.map(p => ({
          ...p,
          hasAttendanceToday: attendedUserIds.has(p.id)
        }));
        setParticipants(enriched);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = !search || 
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      p.unique_id?.toLowerCase().includes(search.toLowerCase());
    
    const matchesBatch = batchFilter === 'all' || p.batch_number === batchFilter;
    
    return matchesSearch && matchesBatch;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all visible participants that don't have attendance
      const usersToSelect = filteredParticipants
        .filter(p => !p.hasAttendanceToday)
        .map(p => p.id);
      setSelectedUsers(usersToSelect);
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleBulkMarkAttendance = async () => {
    if (selectedUsers.length === 0) {
      toast.error(t('admin.selectAtLeastOneUser'));
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

      const attendanceRecords = selectedUsers.map(userId => ({
        user_id: userId,
        date: format(selectedDate, 'yyyy-MM-dd'),
        attendance_type: attendanceType,
        session_name: sessionName,
        check_in_time: new Date().toISOString()
      }));

      const { error } = await supabase.from('attendance').insert(attendanceRecords);

      if (error) throw error;

      toast.success(t('admin.bulkAttendanceMarked', { count: selectedUsers.length }));
      setBulkDialogOpen(false);
      setSelectedUsers([]);
      setAttendanceType('daily');
      setSelectedSession('');
      fetchData();
    } catch (error: any) {
      console.error('Error marking bulk attendance:', error);
      toast.error(error.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAllPresent = async () => {
    const usersWithoutAttendance = filteredParticipants.filter(p => !p.hasAttendanceToday);
    
    if (usersWithoutAttendance.length === 0) {
      toast.info(t('admin.allUsersAlreadyMarked'));
      return;
    }

    setSubmitting(true);
    try {
      const attendanceRecords = usersWithoutAttendance.map(p => ({
        user_id: p.id,
        date: format(selectedDate, 'yyyy-MM-dd'),
        attendance_type: 'daily',
        session_name: null,
        check_in_time: new Date().toISOString()
      }));

      const { error } = await supabase.from('attendance').insert(attendanceRecords);

      if (error) throw error;

      toast.success(t('admin.bulkAttendanceMarked', { count: usersWithoutAttendance.length }));
      fetchData();
    } catch (error: any) {
      console.error('Error marking bulk attendance:', error);
      toast.error(error.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickSessionMark = (sessionId: string) => {
    setAttendanceType('session');
    setSelectedSession(sessionId);
    setBulkDialogOpen(true);
  };

  const presentCount = filteredParticipants.filter(p => p.hasAttendanceToday).length;
  const absentCount = filteredParticipants.length - presentCount;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('admin.bulkAttendance')}
            </CardTitle>
            <CardDescription>{t('admin.bulkAttendanceDesc')}</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={handleMarkAllPresent}
              disabled={submitting || absentCount === 0}
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
              {t('admin.markAllPresent')} ({absentCount})
            </Button>
            <Button 
              onClick={() => setBulkDialogOpen(true)}
              disabled={selectedUsers.length === 0}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t('admin.markSelected')} ({selectedUsers.length})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session-based Quick Marking */}
        {sessions.length > 0 && (
          <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <h4 className="font-medium text-sm">{t('admin.quickSessionMarking')}</h4>
            <div className="flex flex-wrap gap-2">
              {sessions.map(session => (
                <Button
                  key={session.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSessionMark(session.id)}
                  disabled={selectedUsers.length === 0}
                >
                  {session.name}
                </Button>
              ))}
            </div>
            {selectedUsers.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('admin.selectUsersForSession')}</p>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('admin.date')}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start">
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
            <label className="text-sm font-medium">{t('admin.filterByBatch')}</label>
            <Select value={batchFilter} onValueChange={setBatchFilter}>
              <SelectTrigger className="w-[180px]">
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

          <div className="space-y-2 flex-1 max-w-sm">
            <label className="text-sm font-medium">{t('admin.search')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.searchUsers')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <Badge variant="secondary" className="text-sm">
            {t('admin.totalUsers')}: {filteredParticipants.length}
          </Badge>
          <Badge className="bg-success text-success-foreground text-sm">
            {t('admin.present')}: {presentCount}
          </Badge>
          <Badge variant="outline" className="text-sm">
            {t('admin.absent')}: {absentCount}
          </Badge>
        </div>

        {/* Participants Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
        ) : filteredParticipants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t('admin.noParticipantsFound')}</div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUsers.length > 0 && selectedUsers.length === filteredParticipants.filter(p => !p.hasAttendanceToday).length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>{t('admin.participant')}</TableHead>
                  <TableHead>{t('admin.uniqueId')}</TableHead>
                  <TableHead>{t('admin.batch')}</TableHead>
                  <TableHead className="text-center">{t('admin.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParticipants.map((participant) => (
                  <TableRow key={participant.id} className={participant.hasAttendanceToday ? 'bg-success/5' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUsers.includes(participant.id)}
                        onCheckedChange={(checked) => handleSelectUser(participant.id, checked as boolean)}
                        disabled={participant.hasAttendanceToday}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{participant.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{participant.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {participant.unique_id || '-'}
                      </code>
                    </TableCell>
                    <TableCell>
                      {participant.batch_number ? (
                        <Badge variant="outline">{participant.batch_number}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {participant.hasAttendanceToday ? (
                        <Badge className="bg-success text-success-foreground">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t('admin.present')}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t('admin.absent')}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Bulk Mark Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.markSelectedAttendance')}</DialogTitle>
            <DialogDescription>
              {t('admin.markingAttendanceFor', { count: selectedUsers.length })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
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

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm">
                <strong>{t('admin.date')}:</strong> {format(selectedDate, 'PPP')}
              </p>
              <p className="text-sm">
                <strong>{t('admin.usersToMark')}:</strong> {selectedUsers.length}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleBulkMarkAttendance} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t('admin.markAttendance')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
