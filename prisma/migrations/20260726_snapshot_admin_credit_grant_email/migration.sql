ALTER TABLE admin_credit_grants
  ADD COLUMN IF NOT EXISTS granted_by_email VARCHAR(320);

UPDATE admin_credit_grants AS grants
SET granted_by_email = users.email
FROM users
WHERE grants.granted_by_user_id = users.id
  AND grants.granted_by_email IS NULL;

ALTER TABLE admin_credit_grants
  ALTER COLUMN granted_by_email SET NOT NULL;
