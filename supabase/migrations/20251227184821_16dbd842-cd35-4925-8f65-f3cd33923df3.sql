-- Add city column to enrollment_submissions
ALTER TABLE public.enrollment_submissions 
ADD COLUMN IF NOT EXISTS city TEXT;

-- Add unique_id column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS unique_id TEXT UNIQUE;

-- Create function to generate unique ID
CREATE OR REPLACE FUNCTION public.generate_unique_id(
  p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_date_of_birth DATE;
  v_batch_number TEXT;
  v_city TEXT;
  v_first_name TEXT;
  v_surname TEXT;
  v_name_code TEXT;
  v_dob_code TEXT;
  v_batch_code TEXT;
  v_city_code TEXT;
  v_base_id TEXT;
  v_final_id TEXT;
  v_existing_count INTEGER;
  v_first_char INTEGER;
  v_second_char INTEGER;
BEGIN
  -- Get data from enrollment_submissions
  SELECT full_name, date_of_birth, city
  INTO v_full_name, v_date_of_birth, v_city
  FROM enrollment_submissions
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- Get batch number from profiles
  SELECT batch_number
  INTO v_batch_number
  FROM profiles
  WHERE id = p_user_id;
  
  -- Return null if required data is missing
  IF v_full_name IS NULL OR v_date_of_birth IS NULL OR v_batch_number IS NULL OR v_city IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Parse first name and surname
  v_first_name := TRIM(SPLIT_PART(v_full_name, ' ', 1));
  v_surname := TRIM(SPLIT_PART(v_full_name, ' ', array_length(string_to_array(v_full_name, ' '), 1)));
  
  -- If surname is same as first name (single word name), use first name for both
  IF v_surname = v_first_name OR v_surname = '' THEN
    v_surname := v_first_name;
  END IF;
  
  -- Generate name code: first letter position of first name + first letter position of surname
  v_first_char := ASCII(UPPER(LEFT(v_first_name, 1))) - 64;
  v_second_char := ASCII(UPPER(LEFT(v_surname, 1))) - 64;
  
  -- Ensure valid alphabet positions (1-26)
  IF v_first_char < 1 OR v_first_char > 26 THEN v_first_char := 0; END IF;
  IF v_second_char < 1 OR v_second_char > 26 THEN v_second_char := 0; END IF;
  
  v_name_code := LPAD(v_first_char::TEXT, 2, '0') || LPAD(v_second_char::TEXT, 2, '0');
  
  -- Generate DOB code: DDMM
  v_dob_code := LPAD(EXTRACT(DAY FROM v_date_of_birth)::INTEGER::TEXT, 2, '0') ||
                LPAD(EXTRACT(MONTH FROM v_date_of_birth)::INTEGER::TEXT, 2, '0');
  
  -- Generate batch code: first 4 characters
  v_batch_code := LEFT(COALESCE(v_batch_number, '0000'), 4);
  
  -- Generate city code: first 2 letters converted to alphabet positions
  v_first_char := ASCII(UPPER(LEFT(v_city, 1))) - 64;
  v_second_char := ASCII(UPPER(SUBSTRING(v_city, 2, 1))) - 64;
  
  IF v_first_char < 1 OR v_first_char > 26 THEN v_first_char := 0; END IF;
  IF v_second_char < 1 OR v_second_char > 26 THEN v_second_char := 0; END IF;
  
  v_city_code := LPAD(v_first_char::TEXT, 2, '0') || LPAD(v_second_char::TEXT, 2, '0');
  
  -- Combine to form base ID
  v_base_id := v_name_code || v_dob_code || v_batch_code || v_city_code;
  
  -- Check for collisions (count existing users with same base ID, ordered by creation time)
  SELECT COUNT(*)
  INTO v_existing_count
  FROM profiles
  WHERE unique_id LIKE v_base_id || '%'
    AND id != p_user_id;
  
  -- Add suffix if collision exists
  IF v_existing_count > 0 THEN
    v_final_id := v_base_id || '-' || LPAD((v_existing_count + 1)::TEXT, 2, '0');
  ELSE
    v_final_id := v_base_id;
  END IF;
  
  -- Update the profile with the generated ID
  UPDATE profiles
  SET unique_id = v_final_id
  WHERE id = p_user_id
    AND unique_id IS NULL;
  
  RETURN v_final_id;
END;
$$;

-- Create function to regenerate unique ID (for admin use)
CREATE OR REPLACE FUNCTION public.regenerate_unique_id(
  p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id TEXT;
BEGIN
  -- Clear existing unique_id first
  UPDATE profiles SET unique_id = NULL WHERE id = p_user_id;
  
  -- Generate new ID
  SELECT generate_unique_id(p_user_id) INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;