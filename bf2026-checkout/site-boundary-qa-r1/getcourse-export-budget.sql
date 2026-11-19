-- R122: account-wide bounded lease for GetCourse Export API.
-- Export API is read-only and sequential. Cap this integration at 70/100 calls per 2h,
-- reserving at least 30 calls for other authorized integrations.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_getcourse_export_budget (
 account_host text PRIMARY KEY CHECK(account_host='study.shkola-dnv.com'),
 window_started_at timestamptz NOT NULL DEFAULT now(),
 request_count integer NOT NULL DEFAULT 0 CHECK(request_count BETWEEN 0 AND 70),
 outstanding_export_id text,
 outstanding_since timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO bf2026_getcourse_export_budget(account_host)
 VALUES('study.shkola-dnv.com') ON CONFLICT(account_host) DO NOTHING;
COMMENT ON TABLE bf2026_getcourse_export_budget IS
 'Read-only GetCourse Export API account budget; max 70 calls per rolling 2h, one outstanding export, 30 calls reserved for other services. No API key stored.';
COMMIT;
