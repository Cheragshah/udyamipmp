-- Create audit log trigger for participant_progress changes
CREATE OR REPLACE FUNCTION public.log_progress_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (table_name, record_id, user_id, action, old_status, new_status, changed_by, notes)
    VALUES (
      'participant_progress',
      NEW.id,
      NEW.user_id,
      CASE 
        WHEN NEW.status = 'completed' THEN 'approved'
        WHEN NEW.status = 'not_started' THEN 'reset'
        ELSE 'status_changed'
      END,
      OLD.status,
      NEW.status,
      auth.uid(),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for participant_progress status changes
DROP TRIGGER IF EXISTS log_progress_status_change ON public.participant_progress;

CREATE TRIGGER log_progress_status_change
AFTER UPDATE ON public.participant_progress
FOR EACH ROW EXECUTE FUNCTION log_progress_status_change();

-- Also create trigger for new progress entries
CREATE OR REPLACE FUNCTION public.log_progress_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO audit_logs (table_name, record_id, user_id, action, old_status, new_status, changed_by, notes)
  VALUES (
    'participant_progress',
    NEW.id,
    NEW.user_id,
    'created',
    NULL,
    NEW.status,
    auth.uid(),
    NULL
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS log_progress_insert ON public.participant_progress;

CREATE TRIGGER log_progress_insert
AFTER INSERT ON public.participant_progress
FOR EACH ROW EXECUTE FUNCTION log_progress_insert();