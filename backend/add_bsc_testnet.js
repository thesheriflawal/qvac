// add_bsc_testnet.js
// Upserts Binance Smart Chain testnet into the `networks` table.

// const { Client } = require('pg');
import { Client } from 'pg';
import 'dotenv/config';

// Read DB connection settings from environment variables
const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_SSLMODE = 'disable', // 'require' or 'disable', match your DB setup
} = process.env;

console.log(DB_HOST, DB_PORT, DB_USER, DB_NAME);

if (!DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.error('Missing required DB env vars: DB_USER, DB_PASSWORD, DB_NAME');
  process.exit(1);
}

// Your network details
const newNetwork = {
  name: 'Binance Smart Chain',
  chain_key: 'bsc',
  network_type: 'testnet',
  chain_id: 97,
  is_active: true,
};

const client = new Client({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  ssl: DB_SSLMODE === 'require' ? { rejectUnauthorized: true } : false,
});

async function main() {
  try {
    await client.connect();

    const query = `
      INSERT INTO networks (name, chain_key, network_type, chain_id, is_active)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (chain_key, network_type)
      DO UPDATE SET
        name = EXCLUDED.name,
        chain_id = EXCLUDED.chain_id,
        is_active = EXCLUDED.is_active
      RETURNING id, name, chain_key, network_type, chain_id, is_active;
    `;

    const values = [
      newNetwork.name,
      newNetwork.chain_key,
      newNetwork.network_type,
      newNetwork.chain_id,
      newNetwork.is_active,
    ];

    const res = await client.query(query, values);
    console.log('Upserted network:', res.rows[0]);
  } catch (err) {
    console.error('Error inserting network:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();