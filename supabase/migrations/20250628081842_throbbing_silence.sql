/*
  # Add INSERT policy for user_profiles table

  1. Security
    - Add policy for authenticated users to insert their own profile data
    - Ensures users can only create profiles for themselves using auth.uid()

  This fixes the RLS violation error when users try to save their lighthouse goal.
*/

-- Add INSERT policy for user_profiles table
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);