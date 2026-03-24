import pool from './config/db.js';

async function updateTables() {
  try {
    // Add teamspace_id to projects
    await pool.query(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS teamspace_id VARCHAR(255)
    `);
    console.log('Coluna teamspace_id adicionada em projects');

    // Add priority to tasks
    await pool.query(`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'Normal'
    `);
    console.log('Coluna priority adicionada em tasks');

  } catch (err) {
    console.error('Erro ao atualizar tabelas:', err);
  } finally {
    process.exit(0);
  }
}

updateTables();
