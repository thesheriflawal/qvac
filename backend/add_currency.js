// add_usdt_currency.js
// Upserts USDT into the `currencies` table.

import { Client } from "pg";
import "dotenv/config";

// Read DB connection settings from environment variables
const {
  DB_HOST = "localhost",
  DB_PORT = "5432",
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_SSLMODE = "disable", // 'require' or 'disable', match your DB setup
} = process.env;

if (!DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.error("Missing required DB env vars: DB_USER, DB_PASSWORD, DB_NAME");
  process.exit(1);
}

// USDT details
const currency = {
  symbol: "USDC",
  name: "USDC Token",
  decimals: 6,
  is_native: false,
  asset_id: "9001e027-92f7-4c94-a71f-486de77fd63a",
};

const client = new Client({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  ssl: DB_SSLMODE === "require" ? { rejectUnauthorized: true } : false,
});

async function main() {
  try {
    await client.connect();

    const query = `
      INSERT INTO currencies (symbol, name, decimals, is_native, asset_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (symbol)
      DO UPDATE SET
        name = EXCLUDED.name,
        decimals = EXCLUDED.decimals,
        is_native = EXCLUDED.is_native,
        asset_id = EXCLUDED.asset_id
      RETURNING id, symbol, name, decimals, is_native, asset_id;
    `;

    const values = [
      currency.symbol,
      currency.name,
      currency.decimals,
      currency.is_native,
      currency.asset_id,
    ];

    const res = await client.query(query, values);
    console.log("Upserted currency:", res.rows[0]);
  } catch (err) {
    console.error("Error inserting currency:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
