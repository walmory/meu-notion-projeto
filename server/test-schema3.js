import pool from './config/db.js';
async function test() {
  try {
    const [teamspaces] = await pool.query('DESCRIBE teamspaces');
    console.log('TEAMSPACES:', teamspaces.map(t => t.Field));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
  process.exit(0);
}
test();
