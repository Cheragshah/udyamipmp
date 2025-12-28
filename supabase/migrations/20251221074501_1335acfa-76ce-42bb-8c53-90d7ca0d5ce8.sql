-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'coach', 'participant');

-- Create app settings table for branding customization
CREATE TABLE public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name TEXT NOT NULL DEFAULT 'PMP Journey',
    logo_url TEXT,
    primary_color TEXT DEFAULT '#0a0a0a',
    secondary_color TEXT DEFAULT '#737373',
    accent_color TEXT DEFAULT '#2563eb',
    font_family TEXT DEFAULT 'Inter',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    assigned_coach_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'participant',
    UNIQUE (user_id, role)
);

-- Create journey_stages table
CREATE TABLE public.journey_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    stage_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table (32 tasks)
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID REFERENCES public.journey_stages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    guidelines TEXT,
    task_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create participant_progress table
CREATE TABLE public.participant_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    stage_id UUID REFERENCES public.journey_stages(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, stage_id)
);

-- Create task_submissions table
CREATE TABLE public.task_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    submission_notes TEXT,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'verified', 'rejected')),
    verified_by UUID REFERENCES auth.users(id),
    verification_notes TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, task_id)
);

-- Create documents table
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('iec', 'gst', 'rcmc', 'udyam_aadhar', 'shop_act', 'pan_card', 'other')),
    document_name TEXT NOT NULL,
    file_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    review_notes TEXT,
    expiry_date DATE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attendance table
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    attendance_type TEXT NOT NULL CHECK (attendance_type IN ('daily', 'session')),
    session_name TEXT,
    check_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    check_out_time TIMESTAMP WITH TIME ZONE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trades table for trade logging
CREATE TABLE public.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    trade_type TEXT NOT NULL CHECK (trade_type IN ('export', 'import')),
    product_service TEXT NOT NULL,
    country TEXT NOT NULL,
    state TEXT,
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    trade_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sessions table for special sessions
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    session_type TEXT NOT NULL CHECK (session_type IN ('offline_orientation', 'online_orientation', 'special_session', 'ohm_meet')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for app_settings (only admins can modify, everyone can read)
CREATE POLICY "Anyone can view app settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update app settings" ON public.app_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert app settings" ON public.app_settings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Coaches can view assigned participants" ON public.profiles FOR SELECT USING (
    public.has_role(auth.uid(), 'coach') AND assigned_coach_id = auth.uid()
);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for journey_stages (everyone can read, admins can modify)
CREATE POLICY "Anyone authenticated can view stages" ON public.journey_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage stages" ON public.journey_stages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for tasks
CREATE POLICY "Anyone authenticated can view tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage tasks" ON public.tasks FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for participant_progress
CREATE POLICY "Users can view their own progress" ON public.participant_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Coaches can view assigned participants progress" ON public.participant_progress FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND assigned_coach_id = auth.uid())
);
CREATE POLICY "Admins can view all progress" ON public.participant_progress FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update their own progress" ON public.participant_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own progress" ON public.participant_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for task_submissions
CREATE POLICY "Users can view their own submissions" ON public.task_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Coaches can view assigned participants submissions" ON public.task_submissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND assigned_coach_id = auth.uid())
);
CREATE POLICY "Admins can view all submissions" ON public.task_submissions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert their own submissions" ON public.task_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own submissions" ON public.task_submissions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Coaches can verify submissions" ON public.task_submissions FOR UPDATE USING (
    public.has_role(auth.uid(), 'coach') AND EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND assigned_coach_id = auth.uid())
);
CREATE POLICY "Admins can manage all submissions" ON public.task_submissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for documents
CREATE POLICY "Users can view their own documents" ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Coaches can view assigned participants documents" ON public.documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND assigned_coach_id = auth.uid())
);
CREATE POLICY "Admins can view all documents" ON public.documents FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert their own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own documents" ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Coaches can review documents" ON public.documents FOR UPDATE USING (
    public.has_role(auth.uid(), 'coach') AND EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND assigned_coach_id = auth.uid())
);
CREATE POLICY "Admins can manage all documents" ON public.documents FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for attendance
CREATE POLICY "Users can view their own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Coaches can view assigned participants attendance" ON public.attendance FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND assigned_coach_id = auth.uid())
);
CREATE POLICY "Admins can view all attendance" ON public.attendance FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert their own attendance" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for trades
CREATE POLICY "Users can view their own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Coaches can view assigned participants trades" ON public.trades FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND assigned_coach_id = auth.uid())
);
CREATE POLICY "Admins can view all trades" ON public.trades FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can manage their own trades" ON public.trades FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Coaches can send notifications to assigned participants" ON public.notifications FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'coach') AND EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND assigned_coach_id = auth.uid())
);
CREATE POLICY "Admins can manage all notifications" ON public.notifications FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for sessions
CREATE POLICY "Anyone authenticated can view sessions" ON public.sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sessions" ON public.sessions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger function for new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email);
    
    -- Assign default participant role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'participant');
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_task_submissions_updated_at BEFORE UPDATE ON public.task_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default app settings
INSERT INTO public.app_settings (app_name) VALUES ('PMP Journey');

-- Insert journey stages
INSERT INTO public.journey_stages (name, description, stage_order) VALUES
('Enrollment', 'Register for the PMP program', 1),
('Fees Paid', 'Complete payment for the program', 2),
('Offline Orientation', 'Attend offline orientation session', 3),
('Online Orientation', 'Complete online orientation module', 4),
('Documentation', 'Gather and prepare required documents', 5),
('Document Verification', 'Submit documents for verification', 6),
('Special Session', 'Attend special training sessions', 7),
('32 Tasks', 'Complete all 32 mandatory tasks', 8),
('OHM Offline Meet', 'Attend OHM offline meeting', 9),
('Udyami AI Access', 'Get access to Udyami AI platform', 10),
('E-Commerce Setup', 'Set up e-commerce presence', 11);

-- Insert 32 tasks
INSERT INTO public.tasks (stage_id, title, description, guidelines, task_order) 
SELECT 
    (SELECT id FROM public.journey_stages WHERE name = '32 Tasks'),
    title,
    description,
    guidelines,
    task_order
FROM (VALUES
    ('Business Registration', 'Register your business entity', 'Follow the step-by-step guide for business registration', 1),
    ('IEC Code Application', 'Apply for Import Export Code', 'Visit DGFT website and complete IEC application', 2),
    ('GST Registration', 'Register for GST', 'Complete GST registration on the GST portal', 3),
    ('RCMC Registration', 'Obtain RCMC from Export Promotion Council', 'Choose appropriate EPC and apply for RCMC', 4),
    ('Udyam Aadhar', 'Register on Udyam portal', 'Complete Udyam Aadhar registration for MSME benefits', 5),
    ('Shop Act License', 'Obtain Shop Act License', 'Apply for Shop Act license from local authority', 6),
    ('PAN Card', 'Obtain PAN for business', 'Apply for business PAN card', 7),
    ('Bank Account', 'Open current account', 'Open a current account for business transactions', 8),
    ('Product Selection', 'Select export/import product', 'Research and finalize product for trade', 9),
    ('Market Research', 'Conduct market research', 'Analyze target markets and competition', 10),
    ('Buyer/Seller Identification', 'Identify potential partners', 'Find buyers for export or sellers for import', 11),
    ('Sample Procurement', 'Obtain product samples', 'Get samples for quality check and presentation', 12),
    ('Pricing Strategy', 'Develop pricing strategy', 'Calculate costs and set competitive pricing', 13),
    ('Documentation Prep', 'Prepare trade documents', 'Gather all required trade documentation', 14),
    ('Customs Understanding', 'Learn customs procedures', 'Understand customs clearance process', 15),
    ('Shipping Logistics', 'Plan shipping logistics', 'Arrange shipping and logistics partners', 16),
    ('Insurance', 'Arrange trade insurance', 'Get appropriate insurance coverage', 17),
    ('Payment Terms', 'Negotiate payment terms', 'Set up secure payment arrangements', 18),
    ('Quality Control', 'Establish quality checks', 'Set up quality control procedures', 19),
    ('Packaging Standards', 'Meet packaging requirements', 'Ensure proper packaging for international trade', 20),
    ('Labeling Compliance', 'Comply with labeling rules', 'Meet destination country labeling requirements', 21),
    ('Export Documentation', 'Complete export papers', 'Prepare commercial invoice, packing list, etc.', 22),
    ('Import Documentation', 'Complete import papers', 'Prepare bill of entry and related documents', 23),
    ('Letter of Credit', 'Understand LC process', 'Learn about letter of credit procedures', 24),
    ('Foreign Exchange', 'Handle forex transactions', 'Understand foreign exchange procedures', 25),
    ('Trade Finance', 'Explore financing options', 'Learn about trade finance options', 26),
    ('E-commerce Setup', 'Create online presence', 'Set up e-commerce store or listing', 27),
    ('Digital Marketing', 'Market products online', 'Implement digital marketing strategies', 28),
    ('Trade Portal Registration', 'Register on trade portals', 'Create profiles on B2B trade portals', 29),
    ('First Order', 'Secure first order', 'Get your first export or import order', 30),
    ('Order Execution', 'Execute first trade', 'Complete your first trade transaction', 31),
    ('Trade Certification', 'Get trade certified', 'Obtain necessary trade certifications', 32)
) AS t(title, description, guidelines, task_order);