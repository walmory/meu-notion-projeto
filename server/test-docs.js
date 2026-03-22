import mysql from 'mysql2/promise';
async function test() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'meu_notion' });
  try {
    const [rows] = await pool.query('DESCRIBE documents');
    console.log(rows.map(r => `${r.Field} (${r.Type})`).join(', '));
  } catch (e) {
    console.log(e.message);
  }
  process.exit(0);
}
test();
