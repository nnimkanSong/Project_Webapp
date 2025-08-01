const bcrypt = require('bcrypt');

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Missing email or password' });
  }

  try {
    // กำหนดจำนวนรอบ hash (salt rounds)
    const saltRounds = 10;

    // hash รหัสผ่าน
    const passwordhash = await bcrypt.hash(password, saltRounds);

    // เก็บ hashed password ลงฐานข้อมูลแทน password ธรรมดา
    const result = await pool.query(
      'INSERT INTO "User" (email, passwordhash) VALUES ($1, $2) RETURNING *',
      [email, passwordhash]
    );

    res.json({ message: 'insert ok', result: result.rows[0] });
  } catch (error) {
    console.error('Insert error:', error);
    res.status(500).json({ message: 'insert error', error: error.message });
  }
});
