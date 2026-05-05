require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
const sessionSecret = process.env.SESSION_SECRET;
const nodeEnv = process.env.NODE_ENV || 'development';

if (!databaseUrl) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}
if (!googleClientId || !googleClientSecret) {
  throw new Error('Missing required environment variables: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}
if (!callbackUrl) {
  throw new Error('Missing required environment variable: GOOGLE_CALLBACK_URL');
}
if (!sessionSecret && nodeEnv === 'production') {
  throw new Error('Missing required environment variable: SESSION_SECRET (required for production)');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: nodeEnv === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database schema
async function initializeDatabase() {
  try {
    const fs = require('fs');
    const path = require('path');
    const sqlFile = path.join(__dirname, 'database.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    
    await pool.query(sql);
    console.log('✓ Database schema initialized successfully');
  } catch (error) {
    console.error('✗ Database initialization failed:', error.message);
    // Don't exit process, just log the error
  }
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: sessionSecret || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: nodeEnv === 'production' ? { secure: true, httpOnly: true, sameSite: 'lax' } : {}
}));
app.use(passport.initialize());
app.use(passport.session());
app.use('/public', express.static(path.join(__dirname, 'public')));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT id, google_id, email, name FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || null);
  } catch (error) {
    done(error);
  }
});

passport.use(new GoogleStrategy({
  clientID: googleClientId,
  clientSecret: googleClientSecret,
  callbackURL: callbackUrl
}, async (accessToken, refreshToken, profile, done) => {
  const googleId = profile.id;
  const email = profile.emails?.[0]?.value || null;
  const name = profile.displayName || null;

  try {
    const existing = await pool.query('SELECT id, google_id, email, name FROM users WHERE google_id = $1', [googleId]);
    if (existing.rows.length) {
      return done(null, existing.rows[0]);
    }

    const create = await pool.query(
      'INSERT INTO users (google_id, email, name) VALUES ($1, $2, $3) RETURNING id, google_id, email, name',
      [googleId, email, name]
    );
    return done(null, create.rows[0]);
  } catch (error) {
    done(error);
  }
}));

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

async function getSettings(userId) {
  const result = await pool.query('SELECT currency, alerts FROM settings WHERE user_id = $1', [userId]);
  return result.rows[0] || { currency: 'USD', alerts: true };
}

app.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/overview');
  }
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  res.redirect('/overview');
});

app.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) {
      return next(err);
    }
    res.redirect('/login');
  });
});

app.get('/overview', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const [personalEntries, goals, businesses, settings] = await Promise.all([
    pool.query('SELECT * FROM personal_entries WHERE user_id = $1 ORDER BY date DESC', [userId]),
    pool.query('SELECT * FROM goals WHERE user_id = $1 ORDER BY due ASC', [userId]),
    pool.query(
      `SELECT b.id, b.name, b.type, COALESCE(SUM(CASE WHEN bt.type = 'income' THEN bt.amount END), 0) AS income,
        COALESCE(SUM(CASE WHEN bt.type = 'expense' THEN bt.amount END), 0) AS expense
      FROM businesses b
      LEFT JOIN business_transactions bt ON bt.business_id = b.id
      WHERE b.user_id = $1
      GROUP BY b.id
      ORDER BY b.name`,
      [userId]
    ),
    getSettings(userId)
  ]);

  const totalPersonalIncome = personalEntries.rows.filter(entry => entry.type === 'income').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const totalPersonalExpense = personalEntries.rows.filter(entry => entry.type === 'expense').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const personalBalance = totalPersonalIncome - totalPersonalExpense;
  const businessTotals = businesses.rows.map(b => ({
    ...b,
    income: Number(b.income),
    expense: Number(b.expense),
    profit: Number(b.income) - Number(b.expense)
  }));
  const businessBalance = businessTotals.reduce((sum, business) => sum + business.profit, 0);
  const totalIncome = totalPersonalIncome + businessTotals.reduce((sum, business) => sum + business.income, 0);
  const totalExpense = totalPersonalExpense + businessTotals.reduce((sum, business) => sum + business.expense, 0);

  res.render('overview', {
    user: req.user,
    activePage: 'overview',
    settings,
    summary: {
      totalAvailable: personalBalance + businessBalance,
      income: totalIncome,
      expense: totalExpense,
      personalBalance,
      businessBalance
    },
    goals: goals.rows,
    businessTotals
  });
});

app.get('/personal', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const [personalEntries, settings] = await Promise.all([
    pool.query('SELECT * FROM personal_entries WHERE user_id = $1 ORDER BY date DESC', [userId]),
    getSettings(userId)
  ]);

  res.render('personal', {
    user: req.user,
    activePage: 'personal',
    settings,
    personalEntries: personalEntries.rows,
    categories: ['Salary', 'Gifts', 'Food', 'Transport', 'Rent', 'Utilities', 'Other']
  });
});

app.post('/personal', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const { type, description, category, amount, date } = req.body;
  await pool.query(
    'INSERT INTO personal_entries (user_id, type, description, category, amount, date) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, type, description, category, amount, date]
  );
  res.redirect('/personal');
});

app.get('/goals', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const [goals, settings] = await Promise.all([
    pool.query('SELECT * FROM goals WHERE user_id = $1 ORDER BY due ASC', [userId]),
    getSettings(userId)
  ]);
  res.render('goals', {
    user: req.user,
    activePage: 'goals',
    settings,
    goals: goals.rows
  });
});

app.post('/goals', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const { name, target, saved, due } = req.body;
  await pool.query(
    'INSERT INTO goals (user_id, name, target, saved, due) VALUES ($1, $2, $3, $4, $5)',
    [userId, name, target, saved || 0, due]
  );
  res.redirect('/goals');
});

app.get('/business', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const businessId = req.query.id;
  const [businesses, settings] = await Promise.all([
    pool.query('SELECT id, name, type FROM businesses WHERE user_id = $1 ORDER BY name', [userId]),
    getSettings(userId)
  ]);

  let selectedBusiness = null;
  let transactions = [];
  if (businessId) {
    const businessResult = await pool.query('SELECT id, name, type FROM businesses WHERE id = $1 AND user_id = $2', [businessId, userId]);
    selectedBusiness = businessResult.rows[0] || null;
  }

  if (!selectedBusiness && businesses.rows.length) {
    selectedBusiness = businesses.rows[0];
  }

  if (selectedBusiness) {
    const transactionResult = await pool.query(
      'SELECT * FROM business_transactions WHERE business_id = $1 ORDER BY date DESC',
      [selectedBusiness.id]
    );
    transactions = transactionResult.rows;
  }

  res.render('business', {
    user: req.user,
    activePage: 'business',
    settings,
    businesses: businesses.rows,
    selectedBusiness,
    transactions
  });
});

app.post('/business', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const { name, type } = req.body;
  await pool.query('INSERT INTO businesses (user_id, name, type) VALUES ($1, $2, $3)', [userId, name, type]);
  res.redirect('/business');
});

app.post('/business/:id/transaction', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const businessId = req.params.id;
  const { description, amount, type, date } = req.body;
  await pool.query(
    `INSERT INTO business_transactions (business_id, description, amount, type, date)
     SELECT id, $1, $2, $3, $4 FROM businesses WHERE id = $5 AND user_id = $6`,
    [description, amount, type, date || new Date().toISOString().slice(0, 10), businessId, userId]
  );
  res.redirect(`/business?id=${businessId}`);
});

app.get('/combined', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const [personal, businessTotals, settings] = await Promise.all([
    pool.query('SELECT type, amount FROM personal_entries WHERE user_id = $1', [userId]),
    pool.query(
      `SELECT COALESCE(SUM(CASE WHEN bt.type = 'income' THEN bt.amount END),0) AS income,
        COALESCE(SUM(CASE WHEN bt.type = 'expense' THEN bt.amount END),0) AS expense
      FROM businesses b
      LEFT JOIN business_transactions bt ON bt.business_id = b.id
      WHERE b.user_id = $1`,
      [userId]
    ),
    getSettings(userId)
  ]);

  const personalIncome = personal.rows.filter(entry => entry.type === 'income').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const personalExpense = personal.rows.filter(entry => entry.type === 'expense').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const businessIncome = Number(businessTotals.rows[0].income);
  const businessExpense = Number(businessTotals.rows[0].expense);
  const combinedProfit = personalIncome - personalExpense + businessIncome - businessExpense;

  res.render('combined', {
    user: req.user,
    activePage: 'combined',
    settings,
    combined: {
      total: combinedProfit,
      income: personalIncome + businessIncome,
      expense: personalExpense + businessExpense,
      profit: combinedProfit
    }
  });
});

app.get('/settings', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const settings = await getSettings(userId);
  res.render('settings', {
    user: req.user,
    activePage: 'settings',
    settings
  });
});

app.post('/settings', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const { currency, alerts } = req.body;
  await pool.query(
    `INSERT INTO settings (user_id, currency, alerts)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET currency = EXCLUDED.currency, alerts = EXCLUDED.alerts`,
    [userId, currency, alerts === 'on']
  );
  res.redirect('/settings');
});

app.listen(port, async () => {
  console.log(`Boresha app is running on http://localhost:${port}`);
  await initializeDatabase();
});
