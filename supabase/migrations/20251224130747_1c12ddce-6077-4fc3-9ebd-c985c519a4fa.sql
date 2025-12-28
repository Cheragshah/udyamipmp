-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view all audit logs"
ON audit_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can view assigned participants audit logs"
ON audit_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = audit_logs.user_id 
  AND profiles.assigned_coach_id = auth.uid()
));

CREATE POLICY "Users can view their own audit logs"
ON audit_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs"
ON audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Add new columns to trades table for approval workflow
ALTER TABLE public.trades 
ADD COLUMN status text NOT NULL DEFAULT 'pending',
ADD COLUMN attachment_url text,
ADD COLUMN approved_by uuid,
ADD COLUMN approved_at timestamp with time zone,
ADD COLUMN approval_notes text;

-- Create trigger for trade status changes
CREATE TRIGGER log_trade_status_change
AFTER UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.log_status_change();