import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
async function test() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'meu_notion' });
  try {
    const id = uuidv4();
    console.log('Inserting workspace with id:', id);
    await pool.query('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)', [id, 'Test Workspace', 'joao@example.com']);
    console.log('Success');
  } catch (e) {
    console.log('ERROR:', e);
  }
  process.exit(0);
}
test();
