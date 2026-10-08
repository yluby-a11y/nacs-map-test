CREATE TABLE IF NOT EXISTS error_reports (
 id TEXT PRIMARY KEY,
 created_at TEXT NOT NULL,
 version TEXT NOT NULL,
 category TEXT NOT NULL,
 message TEXT NOT NULL,
 platform TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS error_reports_created ON error_reports(created_at);
