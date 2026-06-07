// scripts/add_and_backfill_user_uid.js
// 1) Add users.uid column if missing
// 2) Backfill 14-digit UID for existing users
// 3) Set NOT NULL and add unique constraint

import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kynettic',
    ssl: process.env.DB_SSLMODE === 'require' ? true : false,
  });

  try {
    await client.connect();
    console.log('Connected to Postgres');

    // 1 & 2 in a transaction (column add + backfill + set NOT NULL)
    await client.query('BEGIN');

    // 1) Add uid column if it doesn't exist (nullable first)
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS uid varchar(14)
    `);
    console.log('Ensured uid column exists');

    // 2) Backfill existing rows: uid = 14-digit zero-padded id
    const updateRes = await client.query(`
      UPDATE users
      SET uid = LPAD(id::text, 14, '0')
      WHERE uid IS NULL
    `);
    console.log(`Backfilled uid for ${updateRes.rowCount} users`);

    // 3) Enforce NOT NULL
    await client.query(`
      ALTER TABLE users
      ALTER COLUMN uid SET NOT NULL
    `);
    console.log('Set uid column to NOT NULL');

    // 4) Add unique constraint (id-based UIDs are naturally unique)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name = 'users'
            AND constraint_type = 'UNIQUE'
            AND constraint_name = 'users_uid_key'
        ) THEN
          ALTER TABLE users
          ADD CONSTRAINT users_uid_key UNIQUE (uid);
        END IF;
      END$$;
    `);
    console.log('Ensured unique constraint on uid');

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Error, rolling back:', err);
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('Rollback failed:', rbErr);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();