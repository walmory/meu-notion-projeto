import 'dotenv/config';
import pool from './config/db.js';

async function run() {
  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM documents LIKE 'type'");
    if (columns.length === 0) {
      await pool.query("ALTER TABLE documents ADD COLUMN type VARCHAR(50) DEFAULT 'page'");
      console.log("Added type column to documents");
    } else {
      console.log("Type column already exists");
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
