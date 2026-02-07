-- Add unique constraint on profiles.user_id (should be 1:1 with auth.users)
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- Insert missing profile for admin user
INSERT INTO profiles (user_id, nome)
VALUES ('66f46d75-fbf4-41ee-84b3-04ab91ad322d', 'Bruno Bandeira')
ON CONFLICT (user_id) DO NOTHING;