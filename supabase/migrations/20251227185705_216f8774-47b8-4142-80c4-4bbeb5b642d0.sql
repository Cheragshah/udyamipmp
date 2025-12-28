-- Update the generate_unique_id function to use fallbacks instead of failing
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
  
  -- If no name from enrollment, try to get from profile
  IF v_full_name IS NULL THEN
    SELECT full_name INTO v_full_name FROM profiles WHERE id = p_user_id;
  END IF;
  
  -- Generate name code with fallback to 0000
  IF v_full_name IS NOT NULL AND LENGTH(TRIM(v_full_name)) > 0 THEN
    v_first_name := TRIM(SPLIT_PART(v_full_name, ' ', 1));
    v_surname := TRIM(SPLIT_PART(v_full_name, ' ', array_length(string_to_array(v_full_name, ' '), 1)));
    
    IF v_surname = v_first_name OR v_surname = '' THEN
      v_surname := v_first_name;
    END IF;
    
    v_first_char := ASCII(UPPER(LEFT(v_first_name, 1))) - 64;
    v_second_char := ASCII(UPPER(LEFT(v_surname, 1))) - 64;
    
    IF v_first_char < 1 OR v_first_char > 26 THEN v_first_char := 0; END IF;
    IF v_second_char < 1 OR v_second_char > 26 THEN v_second_char := 0; END IF;
    
    v_name_code := LPAD(v_first_char::TEXT, 2, '0') || LPAD(v_second_char::TEXT, 2, '0');
  ELSE
    v_name_code := '0000';
  END IF;
  
  -- Generate DOB code with fallback to 0000
  IF v_date_of_birth IS NOT NULL THEN
    v_dob_code := LPAD(EXTRACT(DAY FROM v_date_of_birth)::INTEGER::TEXT, 2, '0') ||
                  LPAD(EXTRACT(MONTH FROM v_date_of_birth)::INTEGER::TEXT, 2, '0');
  ELSE
    v_dob_code := '0000';
  END IF;
  
  -- Generate batch code with fallback to 0000
  IF v_batch_number IS NOT NULL AND LENGTH(TRIM(v_batch_number)) > 0 THEN
    v_batch_code := LEFT(v_batch_number, 4);
  ELSE
    v_batch_code := '0000';
  END IF;
  
  -- Generate city code with fallback to 0000
  IF v_city IS NOT NULL AND LENGTH(TRIM(v_city)) >= 2 THEN
    v_first_char := ASCII(UPPER(LEFT(v_city, 1))) - 64;
    v_second_char := ASCII(UPPER(SUBSTRING(v_city, 2, 1))) - 64;
    
    IF v_first_char < 1 OR v_first_char > 26 THEN v_first_char := 0; END IF;
    IF v_second_char < 1 OR v_second_char > 26 THEN v_second_char := 0; END IF;
    
    v_city_code := LPAD(v_first_char::TEXT, 2, '0') || LPAD(v_second_char::TEXT, 2, '0');
  ELSE
    v_city_code := '0000';
  END IF;
  
  -- Combine to form base ID
  v_base_id := v_name_code || v_dob_code || v_batch_code || v_city_code;
  
  -- Check for collisions
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

-- Create trigger function to auto-generate unique ID on enrollment submission
CREATE OR REPLACE FUNCTION public.auto_generate_unique_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-generate unique ID when enrollment is submitted
  PERFORM generate_unique_id(NEW.user_id);
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_auto_generate_unique_id ON enrollment_submissions;

-- Create trigger on enrollment_submissions insert/update
CREATE TRIGGER trigger_auto_generate_unique_id
AFTER INSERT OR UPDATE ON enrollment_submissions
FOR EACH ROW
EXECUTE FUNCTION auto_generate_unique_id();

-- Also create trigger for when batch_number is updated on profiles
CREATE OR REPLACE FUNCTION public.auto_generate_unique_id_on_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate if batch_number changed and unique_id is null
  IF (OLD.batch_number IS DISTINCT FROM NEW.batch_number) AND NEW.unique_id IS NULL THEN
    PERFORM generate_unique_id(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_auto_generate_unique_id_profile ON profiles;

-- Create trigger on profiles batch_number update
CREATE TRIGGER trigger_auto_generate_unique_id_profile
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_generate_unique_id_on_profile();