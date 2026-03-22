import mysql from 'mysql2/promise';
async function test() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'meu_notion' });
  try {
    const [rows] = await pool.query('DESCRIBE users');
    console.log(rows);
  } catch (e) {
    console.log(e.message);
  }
  process.exit(0);
}
test();
