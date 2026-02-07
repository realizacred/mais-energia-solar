-- Add unique constraint for user_id + role and insert admin role
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_role_unique UNIQUE (user_id, role);

INSERT INTO user_roles (user_id, role)
VALUES ('66f46d75-fbf4-41ee-84b3-04ab91ad322d', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;