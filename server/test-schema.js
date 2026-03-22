import mysql from 'mysql2/promise';
async function test() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'meu_notion', socketPath: '/tmp/mysql.sock' });
  try {
    const [users] = await pool.query('DESCRIBE users');
    const [workspaces] = await pool.query('DESCRIBE workspaces');
    const [teamspaces] = await pool.query('DESCRIBE teamspaces');
    console.log('USERS:', users.map(u => u.Field));
    console.log('WORKSPACES:', workspaces.map(w => w.Field));
    console.log('TEAMSPACES:', teamspaces.map(t => t.Field));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
  process.exit(0);
}
test();
