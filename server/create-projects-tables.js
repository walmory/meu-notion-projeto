import pool from './config/db.js';

async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255),
        color VARCHAR(50) DEFAULT 'blue',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table projects successfully created!');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'To Do',
        assigned_to VARCHAR(255),
        due_date DATE,
        position INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);
    console.log('Table tasks successfully created!');

  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    process.exit(0);
  }
}

createTables();
