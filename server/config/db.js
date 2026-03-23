import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '193.203.179.201',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'u906021472_notion',
  password: process.env.DB_PASSWORD || 'Palio2001!!!',
  database: process.env.DB_NAME || 'u906021472_notion',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false }
});

export default pool;
