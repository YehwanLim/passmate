-- Distinguish a request that has reached an external model from one that has
-- only reserved a credit. Completed-provider work must not be auto-refunded.
ALTER TYPE analysis_request_status ADD VALUE IF NOT EXISTS 'CALLING';
ALTER TYPE analysis_request_status ADD VALUE IF NOT EXISTS 'PERSISTENCE_PENDING';
