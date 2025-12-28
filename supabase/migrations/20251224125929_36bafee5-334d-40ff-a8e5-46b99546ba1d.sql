-- Create function to log status changes
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      COALESCE(
        CASE WHEN TG_TABLE_NAME = 'task_submissions' THEN NEW.verified_by END,
        CASE WHEN TG_TABLE_NAME = 'documents' THEN NEW.reviewed_by END,
        CASE WHEN TG_TABLE_NAME = 'enrollment_submissions' THEN NEW.updated_by END,
        auth.uid()
      ),
      COALESCE(
        CASE WHEN TG_TABLE_NAME = 'task_submissions' THEN NEW.verification_notes END,
        CASE WHEN TG_TABLE_NAME = 'documents' THEN NEW.review_notes END,
        CASE WHEN TG_TABLE_NAME = 'enrollment_submissions' THEN NEW.notes END
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers for status change logging
CREATE TRIGGER log_task_submission_status_change
AFTER UPDATE ON public.task_submissions
FOR EACH ROW
EXECUTE FUNCTION public.log_status_change();

CREATE TRIGGER log_document_status_change
AFTER UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.log_status_change();

CREATE TRIGGER log_enrollment_status_change
AFTER UPDATE ON public.enrollment_submissions
FOR EACH ROW
EXECUTE FUNCTION public.log_status_change();

-- Add admin update policies for task_submissions and documents (skip enrollment as it already exists)
CREATE POLICY "Admins can update all task submissions"
ON public.task_submissions FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all documents"
ON public.documents FOR UPDATE
USING (has_role(auth.uid(), 'admin'));