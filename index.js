const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host:     process.env.MYSQLHOST,
  port:     process.env.MYSQLPORT,
  database: process.env.MYSQLDATABASE,
  user:     process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
});

db.connect((err) => {
  if (err) {
    console.error('DB connection failed:', err);
  } else {
    console.log('Connected to MySQL');
  }
});

// ── Users ────────────────────────────────────────────
app.get('/users', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/users', (req, res) => {
  const { name, email, role, staffId } = req.body;
  db.query(
    'INSERT INTO users (name, email, role, staffId) VALUES (?, ?, ?, ?)',
    [name, email, role, staffId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId });
    }
  );
});

// ── Stock ────────────────────────────────────────────
app.get('/stock', (req, res) => {
  db.query('SELECT * FROM stock', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/stock', (req, res) => {
  const { category, style, quantity, threshold } = req.body;
  db.query(
    'INSERT INTO stock (category, style, quantity, threshold) VALUES (?, ?, ?, ?)',
    [category, style, quantity, threshold],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId });
    }
  );
});

app.put('/stock/:id', (req, res) => {
  const { quantity } = req.body;
  db.query(
    'UPDATE stock SET quantity = ? WHERE id = ?',
    [quantity, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// ── Customers ────────────────────────────────────────
app.get('/customers', (req, res) => {
  db.query('SELECT * FROM customers', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/customers', (req, res) => {
  const { name, phone } = req.body;
  db.query(
    'INSERT INTO customers (name, phone) VALUES (?, ?)',
    [name, phone],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId });
    }
  );
});

// ── Invoices ─────────────────────────────────────────
app.get('/invoices', (req, res) => {
  db.query('SELECT * FROM invoices', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/invoices', (req, res) => {
  const { customerId, amount, status, date, dueDate } = req.body;
  db.query(
    'INSERT INTO invoices (customerId, amount, status, date, dueDate) VALUES (?, ?, ?, ?, ?)',
    [customerId, amount, status, date, dueDate],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId });
    }
  );
});

// ── Orders ───────────────────────────────────────────
app.get('/orders', (req, res) => {
  db.query('SELECT * FROM orders', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ── Tasks / Work Distribution ─────────────────────────
app.get('/tasks', (req, res) => {
  db.query('SELECT * FROM tasks', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.put('/tasks/:id', (req, res) => {
  const { completed } = req.body;
  db.query(
    'UPDATE tasks SET completed = ? WHERE id = ?',
    [completed, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// ── Auth ─────────────────────────────────────────────
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  db.query(
    'SELECT * FROM users WHERE email = ? AND password = ?',
    [email, password],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      res.json(results[0]);
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CHUMS API running on port ${PORT}`));