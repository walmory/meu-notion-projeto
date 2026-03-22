import 'dotenv/config';
import pool from './config/db.js';

async function run() {
  try {
    console.log('Adding indexes...');
    
    // Check and add index on workspace_id in documents table
    try {
      await pool.query('CREATE INDEX idx_workspace_id ON documents(workspace_id)');
      console.log('Created index idx_workspace_id on documents');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') console.log('Index idx_workspace_id already exists on documents');
      else {
        console.error('Error on idx_workspace_id:', e);
      }
    }

    try {
      await pool.query('CREATE INDEX idx_docs_workspace_trash ON documents(workspace_id, is_trash)');
      console.log('Created index idx_docs_workspace_trash on documents');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') console.log('Index idx_docs_workspace_trash already exists on documents');
      else {
        console.error('Error on idx_docs_workspace_trash:', e);
      }
    }

    const [userIdColumn] = await pool.query("SHOW COLUMNS FROM documents LIKE 'user_id'");
    if (Array.isArray(userIdColumn) && userIdColumn.length > 0) {
      try {
        await pool.query('CREATE INDEX idx_docs_user_trash ON documents(user_id, is_trash)');
        console.log('Created index idx_docs_user_trash on documents');
      } catch (e) {
        if (e.code === 'ER_DUP_KEYNAME') console.log('Index idx_docs_user_trash already exists on documents');
        else {
          console.error('Error on idx_docs_user_trash:', e);
        }
      }
    } else {
      console.log('Skipped idx_docs_user_trash: column user_id does not exist in documents');
    }

    // Check and add index on user_id in workspace_members table
    try {
      await pool.query('CREATE INDEX idx_user_id ON workspace_members(user_id)');
      console.log('Created index idx_user_id on workspace_members');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') console.log('Index idx_user_id already exists on workspace_members');
      else {
        console.error('Error on idx_user_id:', e);
      }
    }

    console.log('Done!');
  } catch (e) {
    console.error('General Error:', e);
  }
  process.exit(0);
}

run();
