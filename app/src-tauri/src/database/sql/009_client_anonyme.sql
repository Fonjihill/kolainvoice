-- Add is_system flag to clients (0 = normal, 1 = system client)
ALTER TABLE clients ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;

-- Create the "Client anonyme" system client
INSERT INTO clients (name, is_system) VALUES ('Client anonyme', 1);
