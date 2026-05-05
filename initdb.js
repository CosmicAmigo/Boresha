require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  try {
    const sqlFile = path.join(__dirname, 'database.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    
    await pool.query(sql);
    console.log('✓ Database schema initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
