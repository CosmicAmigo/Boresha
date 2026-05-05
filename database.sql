-- PostgreSQL schema and queries for Boresha finance tracking

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target NUMERIC(12, 2) NOT NULL,
  saved NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_transactions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USD',
  alerts BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_personal_entries_user_id ON personal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_business_transactions_business_id ON business_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- User queries
-- Find or create a user by Google ID
SELECT id, google_id, email, name FROM users WHERE google_id = $1;
INSERT INTO users (google_id, email, name) VALUES ($1, $2, $3) RETURNING id, google_id, email, name;

-- Personal entries queries
INSERT INTO personal_entries (user_id, type, description, category, amount, date)
VALUES ($1, $2, $3, $4, $5, $6);
SELECT * FROM personal_entries WHERE user_id = $1 ORDER BY date DESC;

-- Goals queries
INSERT INTO goals (user_id, name, target, saved, due)
VALUES ($1, $2, $3, $4, $5);
SELECT * FROM goals WHERE user_id = $1 ORDER BY due ASC;

-- Businesses queries
INSERT INTO businesses (user_id, name, type)
VALUES ($1, $2, $3);
SELECT id, name, type FROM businesses WHERE user_id = $1 ORDER BY name;

-- Business transaction queries
INSERT INTO business_transactions (business_id, description, amount, type, date)
VALUES ($1, $2, $3, $4, $5);
SELECT * FROM business_transactions WHERE business_id = $1 ORDER BY date DESC;

-- Settings queries
INSERT INTO settings (user_id, currency, alerts)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO UPDATE SET currency = EXCLUDED.currency, alerts = EXCLUDED.alerts;
SELECT currency, alerts FROM settings WHERE user_id = $1;

-- Overview queries
SELECT COALESCE(SUM(amount), 0) AS income FROM personal_entries WHERE user_id = $1 AND type = 'income';
SELECT COALESCE(SUM(amount), 0) AS expense FROM personal_entries WHERE user_id = $1 AND type = 'expense';

SELECT b.id, b.name, b.type,
  COALESCE(SUM(CASE WHEN bt.type = 'income' THEN bt.amount END), 0) AS income,
  COALESCE(SUM(CASE WHEN bt.type = 'expense' THEN bt.amount END), 0) AS expense
FROM businesses b
LEFT JOIN business_transactions bt ON bt.business_id = b.id
WHERE b.user_id = $1
GROUP BY b.id
ORDER BY b.name;

SELECT COALESCE(SUM(CASE WHEN bt.type = 'income' THEN bt.amount END), 0) AS income,
  COALESCE(SUM(CASE WHEN bt.type = 'expense' THEN bt.amount END), 0) AS expense
FROM businesses b
LEFT JOIN business_transactions bt ON bt.business_id = b.id
WHERE b.user_id = $1;
