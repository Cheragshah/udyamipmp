-- Add explicit authentication requirement policies for all sensitive tables

-- Profiles: Require authentication for any access
CREATE POLICY "Require authentication for profiles" 
ON public.profiles 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Documents: Require authentication for any access
CREATE POLICY "Require authentication for documents" 
ON public.documents 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Trades: Require authentication for any access
CREATE POLICY "Require authentication for trades" 
ON public.trades 
FOR ALL 
USING (auth.uid() IS NOT NULL);