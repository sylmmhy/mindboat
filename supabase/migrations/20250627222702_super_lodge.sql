/*
  # Fix destinations table user_id default

  1. Schema Changes
    - Add DEFAULT auth.uid() to user_id column in destinations table
    - This ensures the user_id is automatically set to the authenticated user's ID
    
  2. Security
    - Maintains existing RLS policies
    - Prevents user_id mismatch errors during inserts
*/

-- Add default value to user_id column to automatically use authenticated user's ID
ALTER TABLE destinations 
ALTER COLUMN user_id SET DEFAULT auth.uid();