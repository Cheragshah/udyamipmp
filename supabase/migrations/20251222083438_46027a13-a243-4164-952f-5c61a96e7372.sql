-- Drop and recreate RLS policies for trades table to ensure INSERT works
-- The ALL policy with USING doesn't properly cover INSERT

-- First, drop existing policies that may conflict
DROP POLICY IF EXISTS "Users can manage their own trades" ON public.trades;

-- Create separate policies for each operation
CREATE POLICY "Users can insert their own trades"
ON public.trades
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades"
ON public.trades
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades"
ON public.trades
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);