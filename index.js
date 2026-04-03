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

// Get Orders
app.get('/orders', (req, res) => {
  db.query('SELECT * FROM orders ORDER BY id DESC', (err, results) => {
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

/// update user role
app.put('/users/:id/role', (req, res) => {
  const { role } = req.body;
  db.query(
    'UPDATE users SET role = ? WHERE id = ?',
    [role, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

/// delete user
app.delete('/users/:id', (req, res) => {
  db.query(
    'DELETE FROM users WHERE id = ?',
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

/// post orders 
app.post('/orders', (req, res) => {
  const { customerName, phone, category, style, tailor, quantity, waist, length, color, pickupDate, status } = req.body;
  db.query(
    'INSERT INTO orders (customerName, phone, category, style, tailor, quantity, waist, length, color, pickupDate, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [customerName, phone, category, style, tailor, quantity, waist, length, color, pickupDate, status ?? 'Assigned'],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId });
    }
  );
});

/// post multiple order items
app.post('/orders/bulk', (req, res) => {
  const { customerName, phone, tailor, pickupDate, items } = req.body;

   try {
    // Check if customer exists
    db.query(
      'SELECT id FROM customers WHERE phone = ?',
      [phone],
      (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const createOrders = (customerId) => {
          const values = items.map(item => [
            customerId, customerName, phone, item.category, item.style,
            tailor, item.quantity, item.waist, item.length,
            item.color, pickupDate, 'Assigned'
          ]);

          const placeholders = values.map(() =>
            '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).join(', ');

          db.query(
            `INSERT INTO orders (customerId, customerName, phone, category, style, tailor, quantity, waist, length, color, pickupDate, status) VALUES ${placeholders}`,
            values.flat(),
            (err, result) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ success: true, inserted: result.affectedRows });
            }
          );
        };

        if (results.length > 0) {
          // Customer exists — use their id
          createOrders(results[0].id);
        } else {
          // Customer doesn't exist — create them first
          db.query(
            'INSERT INTO customers (name, phone) VALUES (?, ?)',
            [customerName, phone],
            (err, result) => {
              if (err) return res.status(500).json({ error: err.message });
              createOrders(result.insertId);
            }
          );
        }
      }
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/// update order
app.put('/orders/:id', (req, res) => {
  const { tailor, pickupDate, quantity } = req.body;
  db.query(
    'UPDATE orders SET tailor = ?, pickupDate = ?, quantity = ? WHERE id = ?',
    [tailor, pickupDate, quantity, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

/// delete single order by id
app.delete('/orders/:id', (req, res) => {
  db.query(
    'DELETE FROM orders WHERE id = ?',
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

/// get tailors and embroidery staff
app.get('/users/staff', (req, res) => {
  db.query(
    "SELECT id, userName, firstName, lastName, role FROM users WHERE role IN ('Tailor', 'Embroidery')",
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

/// update customer
app.put('/customers/:id', (req, res) => {
  const { name, phone } = req.body;
  db.query(
    'UPDATE customers SET name = ?, phone = ? WHERE id = ?',
    [name, phone, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

/// delete customer
app.delete('/customers/:id', (req, res) => {
  db.query(
    'DELETE FROM customers WHERE id = ?',
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});


/// put change to save customer history
app.put('/customers/:id', (req, res) => {
  const { name, phone, lastEditedBy, lastEditedAt, changeNote } = req.body;
  db.query(
    'UPDATE customers SET name = ?, phone = ?, lastEditedBy = ?, lastEditedAt = ?, changeNote = ? WHERE id = ?',
    [name, phone, lastEditedBy, lastEditedAt, changeNote, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });

      db.query(
        'UPDATE orders SET customerName = ?, phone = ? WHERE cusomerId = ?',
        [name, phone, req.params.id],
        (err) => {
          if (err) return res.status(500).json({error:err.message});
            res.json({ success: true });
        }
      );
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

/// existiing register route or sign up
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
}); 
/// fresh build
/// fresh build
/// fresh build
/// fresh build
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0' ,() => console.log(`CHUMS API running on port ${PORT}`));