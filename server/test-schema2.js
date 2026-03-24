import pool from './config/db.js';
async function test() {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    console.log('TABLES:', tables.map(t => Object.values(t)[0]));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
  process.exit(0);
}
test();
