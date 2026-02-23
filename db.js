const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false }
});

module.exports = sql;
