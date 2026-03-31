const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');
const {Resend} = require('resend');
const crypto = require ('crypto');
const { error } = require('console');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host:     process.env.MYSQLHOST,
  port:     process.env.MYSQLPORT,
  database: process.env.MYSQLDATABASE,
  user:     process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
});

db.getConnection((err, connection) => {
  if(err) {
    console.err('Database connection failed', err);
  } else{
    console.log('Connected to MySQL');
    connection.release();
  }
});
/// mailer configuration
const resend = new Resend(process.env.RESEND_API_KEY);


//  Users 
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

// ── Invoices 
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

// ── Orders
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

//  Auth
app.post('/auth/login', (req, res) => {
  const { userName, password } = req.body;

  db.query(
    'SELECT * FROM users WHERE userName = ? AND password = ?',
    [userName, password],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });


      if (results.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      res.json(results[0]);
    }
  );
});

/// forgot password
app.post('/auth/forgot-password', (req, res) =>{
  const {email} = req.body;
  const token =crypto.randomBytes(20).toString('hex');
// update user with token and 1 hour expiry
const sql ='UPDATE users SET resetToken =?, resetTokenExpiry = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE email = ?';

db.query(sql, [token, email],async (err, result) => {
  if(err) return res.status(500).json({error: err.message});
  if(result.affectedRows === 0) return res.status(404).json({error: "User not found"});
    try {
      await resend.emails.send({
      from: 'CHUMS System <onboarding@resend.dev>',
      to: email,
      subject: 'Password Reset Request',
      text: `You requested a password reset.\n\nYour reset token is: ${token}\n\nThis token expires in 1 hour.`,
      });
      res.json({ message: 'Reset token sent to email'});
  } catch(error)
  {
    console.error('Resend error:', error);
    res.status(500).json({error: 'Failed to send email.Try again.'});
}
});
});

///reset password- updated
app.post('/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body;

  const sql = 'UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE resetToken = ? AND resetTokenExpiry > NOW()';
  
  db.query(sql, [newPassword, token], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(400).json({ error: "Token invalid or expired" });
    
    res.json({ success: true, message: "Password updated successfully" });
  });
});

/// existiing register route
app.post('/auth/register', (req, res) => {
  const { firstName, lastName, userName, email, phone, password, inviteCode } = req.body;

  const roleMap = {
    'CH-TAILOR': 'Tailor',
    'CH-ADMIN': 'Admin',
    'CH-DELIVERY': 'Delivery',
    'CH-EMB': 'Embroidery',
    'CH-SALES': 'Sales',
    'CH-PACK': 'Packaging'
  };

  const assignedRole = roleMap[inviteCode.toUpperCase()];

  if (!assignedRole) {
    return res.status(400).json({ error: "Invalid Staff Invitation Code" });
  }

  // Generate Staff ID automatically
  const staffId = 'CH-' + Math.floor(1000 + Math.random() * 9000);

  db.query(
     `INSERT INTO users (firstName, lastName, userName, email, phone, password, role, staffId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) `,
  [firstName, lastName, userName, email, phone, password, assignedRole, staffId],
   (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({
      success: true,
      role: assignedRole,
      staffId: staffId
    });
  }
);
}); /// fresh build

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0' ,() => console.log(`CHUMS API running on port ${PORT}`));