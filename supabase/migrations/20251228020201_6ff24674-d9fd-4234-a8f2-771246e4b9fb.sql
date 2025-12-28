-- Drop existing triggers first
DROP TRIGGER IF EXISTS log_task_submission_status_change ON public.task_submissions;
DROP TRIGGER IF EXISTS log_document_status_change ON public.documents;
DROP TRIGGER IF EXISTS log_enrollment_status_change ON public.enrollment_submissions;
DROP TRIGGER IF EXISTS log_trade_status_change ON public.trades;

-- Drop the problematic function
DROP FUNCTION IF EXISTS public.log_status_change();

-- Create separate trigger functions for each table

-- For task_submissions
CREATE OR REPLACE FUNCTION public.log_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (table_name, record_id, user_id, action, old_status, new_status, changed_by, notes)
    VALUES (
      'task_submissions',
      NEW.id,
      NEW.user_id,
      CASE 
        WHEN NEW.status IN ('approved', 'verified', 'completed') THEN 'approved'
        WHEN NEW.status = 'rejected' THEN 'rejected'
        ELSE 'status_changed'
      END,
      OLD.status,
      NEW.status,
      COALESCE(NEW.verified_by, auth.uid()),
      NEW.verification_notes
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- For documents
CREATE OR REPLACE FUNCTION public.log_document_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (table_name, record_id, user_id, action, old_status, new_status, changed_by, notes)
    VALUES (
      'documents',
      NEW.id,
      NEW.user_id,
      CASE 
        WHEN NEW.status IN ('approved', 'verified', 'completed') THEN 'approved'
        WHEN NEW.status = 'rejected' THEN 'rejected'
        ELSE 'status_changed'
      END,
      OLD.status,
      NEW.status,
      COALESCE(NEW.reviewed_by, auth.uid()),
      NEW.review_notes
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- For enrollment_submissions
CREATE OR REPLACE FUNCTION public.log_enrollment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (table_name, record_id, user_id, action, old_status, new_status, changed_by, notes)
    VALUES (
      'enrollment_submissions',
      NEW.id,
      NEW.user_id,
      CASE 
        WHEN NEW.status IN ('approved', 'verified', 'completed') THEN 'approved'
        WHEN NEW.status = 'rejected' THEN 'rejected'
        ELSE 'status_changed'
      END,
      OLD.status,
      NEW.status,
      COALESCE(NEW.updated_by, auth.uid()),
      NEW.notes
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- For trades
CREATE OR REPLACE FUNCTION public.log_trade_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (table_name, record_id, user_id, action, old_status, new_status, changed_by, notes)
    VALUES (
      'trades',
      NEW.id,
      NEW.user_id,
      CASE 
        WHEN NEW.status IN ('approved', 'verified', 'completed') THEN 'approved'
        WHEN NEW.status = 'rejected' THEN 'rejected'
        ELSE 'status_changed'
      END,
      OLD.status,
      NEW.status,
      COALESCE(NEW.approved_by, auth.uid()),
      NEW.approval_notes
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate triggers with separate functions
CREATE TRIGGER log_task_submission_status_change
AFTER UPDATE ON public.task_submissions
FOR EACH ROW EXECUTE FUNCTION log_task_status_change();

CREATE TRIGGER log_document_status_change
AFTER UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION log_document_status_change();

CREATE TRIGGER log_enrollment_status_change
AFTER UPDATE ON public.enrollment_submissions
FOR EACH ROW EXECUTE FUNCTION log_enrollment_status_change();

CREATE TRIGGER log_trade_status_change
AFTER UPDATE ON public.trades
FOR EACH ROW EXECUTE FUNCTION log_trade_status_change();