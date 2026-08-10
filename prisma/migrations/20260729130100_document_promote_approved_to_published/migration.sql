-- Existing APPROVED docs were the terminal/final stage before PUBLISHED existed.
UPDATE "LibraryDocument"
SET status = 'PUBLISHED'
WHERE status = 'APPROVED';
