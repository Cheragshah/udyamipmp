-- Fix the log_status_change trigger to handle trades table properly
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (table_name, record_id, user_id, action, old_status, new_status, changed_by, notes)
    VALUES (
      TG_TABLE_NAME,
      NEW.id,
      NEW.user_id,
      CASE 
        WHEN NEW.status IN ('approved', 'verified', 'completed') THEN 'approved'
        WHEN NEW.status = 'rejected' THEN 'rejected'
        ELSE 'status_changed'
      END,
      OLD.status,
      NEW.status,
      CASE TG_TABLE_NAME
        WHEN 'task_submissions' THEN NEW.verified_by
        WHEN 'documents' THEN NEW.reviewed_by
        WHEN 'enrollment_submissions' THEN NEW.updated_by
        WHEN 'trades' THEN NEW.approved_by
        ELSE auth.uid()
      END,
      CASE TG_TABLE_NAME
        WHEN 'task_submissions' THEN NEW.verification_notes
        WHEN 'documents' THEN NEW.review_notes
        WHEN 'enrollment_submissions' THEN NEW.notes
        WHEN 'trades' THEN NEW.approval_notes
        ELSE NULL
      END
    );
  END IF;
  RETURN NEW;
END;
$function$;