CREATE TABLE IF NOT EXISTS api_daily_budget (
 day TEXT NOT NULL,
 provider TEXT NOT NULL,
 calls INTEGER NOT NULL CHECK(calls>=0),
 PRIMARY KEY(day,provider)
);
