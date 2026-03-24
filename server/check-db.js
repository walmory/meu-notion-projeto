import pool from './config/db.js';

async function check() {
  try {
    console.log('Checking projects table...');
    const [pCols] = await pool.query('SHOW COLUMNS FROM projects');
    console.log(pCols.map(c => c.Field));

    console.log('Checking tasks table...');
    const [tCols] = await pool.query('SHOW COLUMNS FROM tasks');
    console.log(tCols.map(c => c.Field));
  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    process.exit(0);
  }
}
check();
