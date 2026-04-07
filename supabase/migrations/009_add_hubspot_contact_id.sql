-- Add hubspot_contact_id to pages table for engagement tracking
ALTER TABLE pages ADD COLUMN IF NOT EXISTS hubspot_contact_id VARCHAR(255);
