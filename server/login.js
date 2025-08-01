const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'postgres',
  host: 'db',
  database: 'mydb',
  password: 'postgres',
  port: 5432,
});

// Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // หาผู้ใช้จาก email
    const result = await pool.query(
      'SELECT * FROM "User" WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    // เปรียบเทียบ password ดิบ กับ hash
    const match = await bcrypt.compare(password, user.passwordhash);

    if (!match) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // เข้าสู่ระบบสำเร็จ
    res.json({ message: 'Login successful', userId: user.id, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login error', error: err.message });
  }
});

app.listen(5001, () => console.log('Server running on port 5001'));
