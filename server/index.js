const express = require('express');
const cors = require('cors');
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

app.get('/api', async (req, res) => {
  const result = await pool.query('SELECT NOW()');
  res.json(result.rows);
});

app.listen(5001, () => console.log('Backend running on port 5001'));

app.use(express.json());

const bcrypt = require('bcrypt');

app.post('/api/create', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // แปลง password เป็น hash
    const saltRounds = 10; // ยิ่งมากยิ่งปลอดภัย แต่ช้าขึ้น
    const passwordhash = await bcrypt.hash(password, saltRounds);

    // เก็บ username, email, passwordhash ลงฐานข้อมูล
    const result = await pool.query(
      'INSERT INTO "User" (username, email, passwordhash) VALUES ($1, $2, $3) RETURNING *',
      [username, email, passwordhash]
    );

    res.json({ message: 'User registered', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});
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
