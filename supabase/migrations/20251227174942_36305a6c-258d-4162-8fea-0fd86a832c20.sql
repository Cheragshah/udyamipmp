-- Add batch_number column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS batch_number text DEFAULT NULL;

-- Create table for special session links
CREATE TABLE IF NOT EXISTS public.special_session_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    link_url text NOT NULL,
    session_type text NOT NULL DEFAULT 'special_session',
    target_batch text DEFAULT NULL,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create table for user session completions (for tracking orientation sessions etc)
CREATE TABLE IF NOT EXISTS public.user_session_completions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    session_type text NOT NULL,
    completed_at timestamptz DEFAULT now(),
    marked_by uuid REFERENCES auth.users(id),
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Add unique constraint to prevent duplicates
ALTER TABLE public.user_session_completions ADD CONSTRAINT unique_user_session UNIQUE (user_id, session_type);

-- Enable RLS on new tables
ALTER TABLE public.special_session_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_session_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for special_session_links
CREATE POLICY "Admins can manage special session links" 
ON public.special_session_links FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coaches can manage special session links" 
ON public.special_session_links FOR ALL 
USING (has_role(auth.uid(), 'coach'::app_role));

CREATE POLICY "Users can view active special session links" 
ON public.special_session_links FOR SELECT 
USING (is_active = true);

-- RLS Policies for user_session_completions
CREATE POLICY "Admins can manage all session completions" 
ON public.user_session_completions FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coaches can manage assigned users session completions" 
ON public.user_session_completions FOR ALL 
USING (
    has_role(auth.uid(), 'coach'::app_role) AND 
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = user_session_completions.user_id 
        AND profiles.assigned_coach_id = auth.uid()
    )
);

CREATE POLICY "Users can view their own session completions" 
ON public.user_session_completions FOR SELECT 
USING (auth.uid() = user_id);

-- Update trigger for special_session_links
CREATE TRIGGER update_special_session_links_updated_at
BEFORE UPDATE ON public.special_session_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();