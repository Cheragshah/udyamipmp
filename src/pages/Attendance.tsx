import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CheckCircle2, Clock, Users, Video, MapPin, Info } from 'lucide-react';
import { format, isToday, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { formatLocalizedNumber, formatLocalizedPercent, formatLocalizedDate, getDateLocale } from '@/lib/formatters';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AttendanceRecord {
  id: string;
  date: string;
  attendance_type: string;
  session_name: string | null;
  check_in_time: string;
  check_out_time: string | null;
}

interface Session {
  id: string;
  name: string;
  session_type: string;
  scheduled_at: string | null;
  location: string | null;
  duration_minutes: number | null;
  is_active: boolean;
}

export default function Attendance() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth] = useState(new Date());

  const locale = i18n.language;
  const dateLocale = getDateLocale(locale);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user?.id)
        .order('date', { ascending: false });

      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .order('scheduled_at');

      if (attendanceData) setAttendance(attendanceData);
      if (sessionsData) setSessions(sessionsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasTodayAttendance = attendance.some(
    (a) => a.attendance_type === 'daily' && isToday(parseISO(a.date))
  );

  const hasSessionAttendance = (sessionName: string) => {
    return attendance.some((a) => a.session_name === sessionName);
  };

  // Calendar calculations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const dailyAttendanceDays = attendance
    .filter((a) => a.attendance_type === 'daily')
    .map((a) => parseISO(a.date));

  const attendanceRate = Math.round(
    (dailyAttendanceDays.length / new Date().getDate()) * 100
  );

  const weekDays = [
    t('calendar.sun'),
    t('calendar.mon'),
    t('calendar.tue'),
    t('calendar.wed'),
    t('calendar.thu'),
    t('calendar.fri'),
    t('calendar.sat'),
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('attendance.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('attendance.subtitle')}
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {t('attendance.markedByCoach')}
        </AlertDescription>
      </Alert>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatLocalizedNumber(dailyAttendanceDays.length, locale)}</p>
                <p className="text-sm text-muted-foreground">{t('attendance.daysPresent')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatLocalizedPercent(attendanceRate, locale)}</p>
                <p className="text-sm text-muted-foreground">{t('attendance.attendanceRate')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatLocalizedNumber(attendance.filter((a) => a.attendance_type === 'session').length, locale)}
                </p>
                <p className="text-sm text-muted-foreground">{t('attendance.sessionsAttended')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Status */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('attendance.todayStatus')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasTodayAttendance ? (
            <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-success" />
              <div>
                <p className="font-medium text-success">{t('attendance.attendanceMarked')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('attendance.checkedInToday')}, {formatLocalizedDate(new Date(), 'PPP', locale)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg">
              <Clock className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="font-medium">{t('attendance.notMarkedToday')}</p>
                <p className="text-sm text-muted-foreground">
                  {formatLocalizedDate(new Date(), 'EEEE, PPP', locale)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sessions Status */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            {t('attendance.sessions')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('attendance.noUpcomingSessions')}
            </p>
          ) : (
            sessions.map((session) => {
              const attended = hasSessionAttendance(session.name);

              return (
                <div
                  key={session.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    attended ? 'bg-success/10' : 'bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        session.session_type === 'online'
                          ? 'bg-primary/10'
                          : 'bg-accent/10'
                      }`}
                    >
                      {session.session_type === 'online' ? (
                        <Video className="h-5 w-5 text-primary" />
                      ) : (
                        <MapPin className="h-5 w-5 text-accent" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{session.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {t(`attendance.${session.session_type}`)}
                        </Badge>
                        {session.location && <span>• {session.location}</span>}
                        {session.scheduled_at && (
                          <span>
                            • {formatLocalizedDate(parseISO(session.scheduled_at), 'MMM d, h:mm a', locale)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {attended ? (
                    <Badge className="bg-success text-success-foreground">
                      {t('attendance.attended')}
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      {t('attendance.pending')}
                    </Badge>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Attendance Calendar */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>
            {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })} {t('attendance.attendanceCalendar')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekDays.map((day) => (
              <div key={day} className="p-2 text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {/* Empty cells for days before month starts */}
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2" />
            ))}
            {daysInMonth.map((day) => {
              const isPresent = dailyAttendanceDays.some((d) => isSameDay(d, day));
              const isTodayDate = isToday(day);
              const isPast = day < new Date() && !isTodayDate;

              return (
                <div
                  key={day.toISOString()}
                  className={`p-2 rounded-lg text-sm ${
                    isPresent
                      ? 'bg-success text-success-foreground font-medium'
                      : isTodayDate
                      ? 'bg-primary text-primary-foreground font-medium'
                      : isPast
                      ? 'text-muted-foreground'
                      : 'text-foreground'
                  }`}
                >
                  {formatLocalizedNumber(parseInt(format(day, 'd')), locale)}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
