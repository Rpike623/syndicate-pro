// SyndicatePro API Server
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password, companyName } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, company_name) VALUES ($1, $2, $3) RETURNING id, email, company_name',
      [email, hashedPassword, companyName]
    );
    const token = jwt.sign({ userId: result.rows[0].id }, process.env.JWT_SECRET);
    res.json({ user: result.rows[0], token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'User not found' });
    
    const validPassword = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });
    
    const token = jwt.sign({ userId: result.rows[0].id }, process.env.JWT_SECRET);
    res.json({ 
      user: { id: result.rows[0].id, email: result.rows[0].email, companyName: result.rows[0].company_name },
      token 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deals API
app.get('/api/deals', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM deals WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/deals', authenticateToken, async (req, res) => {
  const { name, location, propertyType, totalRaise, targetIrr, waterfallType } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO deals (user_id, name, location, property_type, total_raise, target_irr, waterfall_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'sourcing') RETURNING *`,
      [req.user.userId, name, location, propertyType, totalRaise, targetIrr, waterfallType]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/deals/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM deals WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Deal not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Investors API
app.get('/api/investors', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM investors WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/investors', authenticateToken, async (req, res) => {
  const { name, email, phone, investmentCapacity, accreditationStatus, notes } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO investors (user_id, name, email, phone, investment_capacity, accreditation_status, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'lead', $7) RETURNING *`,
      [req.user.userId, name, email, phone, investmentCapacity, accreditationStatus, notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Investments API (join table)
app.get('/api/deals/:dealId/investments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, inv.name as investor_name, inv.email as investor_email
       FROM investments i
       JOIN investors inv ON i.investor_id = inv.id
       WHERE i.deal_id = $1`,
      [req.params.dealId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/investments', authenticateToken, async (req, res) => {
  const { dealId, investorId, amount, ownershipPercent } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO investments (deal_id, investor_id, amount, ownership_percent, status)
       VALUES ($1, $2, $3, $4, 'committed') RETURNING *`,
      [dealId, investorId, amount, ownershipPercent]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Distributions API
app.post('/api/distributions', authenticateToken, async (req, res) => {
  const { dealId, totalAmount, distributionType, quarter, year } = req.body;
  
  try {
    // Get deal waterfall settings
    const dealResult = await pool.query('SELECT * FROM deals WHERE id = $1', [dealId]);
    const deal = dealResult.rows[0];
    
    // Calculate distributions based on waterfall
    const investments = await pool.query(
      'SELECT * FROM investments WHERE deal_id = $1',
      [dealId]
    );
    
    const distributions = investments.rows.map(inv => {
      const investorShare = (inv.ownership_percent / 100) * totalAmount;
      return {
        investmentId: inv.id,
        investorId: inv.investor_id,
        amount: investorShare,
        status: 'pending'
      };
    });
    
    // Save distribution batch
    const distResult = await pool.query(
      `INSERT INTO distributions (deal_id, total_amount, distribution_type, quarter, year, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [dealId, totalAmount, distributionType, quarter, year, req.user.userId]
    );
    
    // Save individual distribution records
    for (const dist of distributions) {
      await pool.query(
        `INSERT INTO distribution_records (distribution_id, investment_id, investor_id, amount, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [distResult.rows[0].id, dist.investmentId, dist.investorId, dist.amount, 'pending']
      );
    }
    
    res.json({ distribution: distResult.rows[0], investorDistributions: distributions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Database schema initialization
app.post('/api/admin/init-db', async (req, res) => {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      company_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS deals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255),
      property_type VARCHAR(50),
      total_raise DECIMAL(15,2),
      target_irr DECIMAL(5,2),
      waterfall_type VARCHAR(50),
      status VARCHAR(50) DEFAULT 'sourcing',
      created_at TIMESTAMP