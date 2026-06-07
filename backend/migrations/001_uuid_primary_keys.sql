-- Migration: Convert all primary keys from bigint to UUID
--
-- WARNING: This migration is DESTRUCTIVE for existing data if rows cannot be
-- mapped cleanly. Run against a development database or take a backup first.
--
-- Prerequisites: PostgreSQL 13+ (for gen_random_uuid()) or enable pgcrypto.
--
-- Usage:
--   psql -U <user> -d <dbname> -f migrations/001_uuid_primary_keys.sql

BEGIN;

-- 0. Ensure gen_random_uuid() is available.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Drop ALL foreign-key constraints that reference any id column.
--    We query pg_constraint so the script is portable regardless of how
--    GORM named the constraints.
-- ============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT conname, conrelid::regclass AS tbl
        FROM pg_constraint
        WHERE contype = 'f'
          AND confrelid::regclass::text IN (
              'users','networks','currencies','wallets','p2p_ads',
              'p2p_orders','wallet_transactions','crypto_deposits',
              'crypto_withdrawals','crypto_addresses','fiat_deposits',
              'fiat_withdrawals','bank_accounts','internal_transfers',
              'notifications','notification_settings','kyc_verifications',
              'user_profiles','user_security'
          )
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
    END LOOP;
END
$$;

-- ============================================================================
-- 2. ROOT TABLES — convert id from bigint to uuid.
--    For each table we:
--      a) add a temporary uuid column,
--      b) populate it from the existing integer id (or gen_random_uuid()),
--      c) store the old→new mapping in a temp table,
--      d) drop the old column and rename.
-- ============================================================================

-- Helper: create a temporary mapping table for old_id → new_uuid.
-- We reuse this pattern for every root table.

-- ---------- users ----------
CREATE TEMP TABLE _map_users AS
    SELECT id AS old_id, gen_random_uuid() AS new_id FROM users;

ALTER TABLE users ADD COLUMN id_new UUID;
UPDATE users SET id_new = m.new_id FROM _map_users m WHERE users.id = m.old_id;
ALTER TABLE users ALTER COLUMN id_new SET DEFAULT gen_random_uuid();
ALTER TABLE users ALTER COLUMN id_new SET NOT NULL;

-- ---------- networks ----------
CREATE TEMP TABLE _map_networks AS
    SELECT id AS old_id, gen_random_uuid() AS new_id FROM networks;

ALTER TABLE networks ADD COLUMN id_new UUID;
UPDATE networks SET id_new = m.new_id FROM _map_networks m WHERE networks.id = m.old_id;
ALTER TABLE networks ALTER COLUMN id_new SET DEFAULT gen_random_uuid();
ALTER TABLE networks ALTER COLUMN id_new SET NOT NULL;

-- ---------- currencies ----------
CREATE TEMP TABLE _map_currencies AS
    SELECT id AS old_id, gen_random_uuid() AS new_id FROM currencies;

ALTER TABLE currencies ADD COLUMN id_new UUID;
UPDATE currencies SET id_new = m.new_id FROM _map_currencies m WHERE currencies.id = m.old_id;
ALTER TABLE currencies ALTER COLUMN id_new SET DEFAULT gen_random_uuid();
ALTER TABLE currencies ALTER COLUMN id_new SET NOT NULL;

-- ---------- wallets ----------
CREATE TEMP TABLE _map_wallets AS
    SELECT id AS old_id, gen_random_uuid() AS new_id FROM wallets;

ALTER TABLE wallets ADD COLUMN id_new UUID;
UPDATE wallets SET id_new = m.new_id FROM _map_wallets m WHERE wallets.id = m.old_id;
ALTER TABLE wallets ALTER COLUMN id_new SET DEFAULT gen_random_uuid();
ALTER TABLE wallets ALTER COLUMN id_new SET NOT NULL;

-- ---------- p2p_ads ----------
CREATE TEMP TABLE _map_p2p_ads AS
    SELECT id AS old_id, gen_random_uuid() AS new_id FROM p2p_ads;

ALTER TABLE p2p_ads ADD COLUMN id_new UUID;
UPDATE p2p_ads SET id_new = m.new_id FROM _map_p2p_ads m WHERE p2p_ads.id = m.old_id;
ALTER TABLE p2p_ads ALTER COLUMN id_new SET DEFAULT gen_random_uuid();
ALTER TABLE p2p_ads ALTER COLUMN id_new SET NOT NULL;

-- ============================================================================
-- 3. DEPENDENT TABLES — convert their own id + all FK columns.
--    Pattern: add uuid columns, populate via mapping tables, then clean up.
-- ============================================================================

-- ---------- user_profiles ----------
ALTER TABLE user_profiles ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE user_profiles ADD COLUMN user_id_new UUID;
UPDATE user_profiles SET user_id_new = m.new_id FROM _map_users m WHERE user_profiles.user_id = m.old_id;

-- ---------- user_security ----------
ALTER TABLE user_security ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE user_security ADD COLUMN user_id_new UUID;
UPDATE user_security SET user_id_new = m.new_id FROM _map_users m WHERE user_security.user_id = m.old_id;

-- ---------- wallets (FK: user_id, currency_id) ----------
ALTER TABLE wallets ADD COLUMN user_id_new UUID;
ALTER TABLE wallets ADD COLUMN currency_id_new UUID;
UPDATE wallets SET
    user_id_new     = mu.new_id,
    currency_id_new = mc.new_id
FROM _map_users mu, _map_currencies mc
WHERE wallets.user_id = mu.old_id AND wallets.currency_id = mc.old_id;

-- ---------- wallet_transactions (FK: wallet_id) ----------
ALTER TABLE wallet_transactions ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE wallet_transactions ADD COLUMN wallet_id_new UUID;
UPDATE wallet_transactions SET wallet_id_new = m.new_id FROM _map_wallets m WHERE wallet_transactions.wallet_id = m.old_id;

-- ---------- p2p_ads (FK: user_id) ----------
ALTER TABLE p2p_ads ADD COLUMN user_id_new UUID;
UPDATE p2p_ads SET user_id_new = m.new_id FROM _map_users m WHERE p2p_ads.user_id = m.old_id;

-- ---------- p2p_orders (FK: ad_id, buyer_id, seller_id, escrow_wallet_id) ----------
ALTER TABLE p2p_orders ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE p2p_orders ADD COLUMN ad_id_new UUID;
ALTER TABLE p2p_orders ADD COLUMN buyer_id_new UUID;
ALTER TABLE p2p_orders ADD COLUMN seller_id_new UUID;
ALTER TABLE p2p_orders ADD COLUMN escrow_wallet_id_new UUID;
UPDATE p2p_orders SET
    ad_id_new     = ma.new_id,
    buyer_id_new  = mb.new_id,
    seller_id_new = ms.new_id
FROM _map_p2p_ads ma, _map_users mb, _map_users ms
WHERE p2p_orders.ad_id = ma.old_id
  AND p2p_orders.buyer_id = mb.old_id
  AND p2p_orders.seller_id = ms.old_id;
UPDATE p2p_orders SET escrow_wallet_id_new = m.new_id FROM _map_wallets m WHERE p2p_orders.escrow_wallet_id = m.old_id;

-- ---------- crypto_deposits (FK: user_id) ----------
ALTER TABLE crypto_deposits ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE crypto_deposits ADD COLUMN user_id_new UUID;
UPDATE crypto_deposits SET user_id_new = m.new_id FROM _map_users m WHERE crypto_deposits.user_id = m.old_id;

-- ---------- crypto_withdrawals (FK: user_id) ----------
ALTER TABLE crypto_withdrawals ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE crypto_withdrawals ADD COLUMN user_id_new UUID;
UPDATE crypto_withdrawals SET user_id_new = m.new_id FROM _map_users m WHERE crypto_withdrawals.user_id = m.old_id;

-- ---------- crypto_addresses (FK: user_id, network_id, currency_id) ----------
ALTER TABLE crypto_addresses ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE crypto_addresses ADD COLUMN user_id_new UUID;
ALTER TABLE crypto_addresses ADD COLUMN network_id_new UUID;
ALTER TABLE crypto_addresses ADD COLUMN currency_id_new UUID;
UPDATE crypto_addresses SET
    user_id_new     = mu.new_id,
    network_id_new  = mn.new_id,
    currency_id_new = mc.new_id
FROM _map_users mu, _map_networks mn, _map_currencies mc
WHERE crypto_addresses.user_id = mu.old_id
  AND crypto_addresses.network_id = mn.old_id
  AND crypto_addresses.currency_id = mc.old_id;

-- ---------- fiat_deposits (FK: user_id) ----------
ALTER TABLE fiat_deposits ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE fiat_deposits ADD COLUMN user_id_new UUID;
UPDATE fiat_deposits SET user_id_new = m.new_id FROM _map_users m WHERE fiat_deposits.user_id = m.old_id;

-- ---------- fiat_withdrawals (FK: user_id) ----------
ALTER TABLE fiat_withdrawals ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE fiat_withdrawals ADD COLUMN user_id_new UUID;
UPDATE fiat_withdrawals SET user_id_new = m.new_id FROM _map_users m WHERE fiat_withdrawals.user_id = m.old_id;

-- ---------- bank_accounts (FK: user_id) ----------
ALTER TABLE bank_accounts ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE bank_accounts ADD COLUMN user_id_new UUID;
UPDATE bank_accounts SET user_id_new = m.new_id FROM _map_users m WHERE bank_accounts.user_id = m.old_id;

-- ---------- internal_transfers (FK: sender_id, receiver_id) ----------
ALTER TABLE internal_transfers ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE internal_transfers ADD COLUMN sender_id_new UUID;
ALTER TABLE internal_transfers ADD COLUMN receiver_id_new UUID;
UPDATE internal_transfers SET
    sender_id_new   = ms.new_id,
    receiver_id_new = mr.new_id
FROM _map_users ms, _map_users mr
WHERE internal_transfers.sender_id = ms.old_id
  AND internal_transfers.receiver_id = mr.old_id;

-- ---------- notifications (FK: user_id) ----------
ALTER TABLE notifications ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE notifications ADD COLUMN user_id_new UUID;
UPDATE notifications SET user_id_new = m.new_id FROM _map_users m WHERE notifications.user_id = m.old_id;

-- ---------- notification_settings (FK: user_id) ----------
ALTER TABLE notification_settings ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE notification_settings ADD COLUMN user_id_new UUID;
UPDATE notification_settings SET user_id_new = m.new_id FROM _map_users m WHERE notification_settings.user_id = m.old_id;

-- ---------- kyc_verifications (FK: user_id) ----------
ALTER TABLE kyc_verifications ADD COLUMN id_new UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE kyc_verifications ADD COLUMN user_id_new UUID;
UPDATE kyc_verifications SET user_id_new = m.new_id FROM _map_users m WHERE kyc_verifications.user_id = m.old_id;

-- ============================================================================
-- 4. DROP old columns, sequences, and primary keys. RENAME new columns.
-- ============================================================================

-- Helper function to swap columns for every table.
-- Drop old PK, drop old column, rename new column, add new PK.

-- ---- users ----
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE users DROP COLUMN id;
ALTER TABLE users RENAME COLUMN id_new TO id;
ALTER TABLE users ADD PRIMARY KEY (id);

-- ---- networks ----
ALTER TABLE networks DROP CONSTRAINT IF EXISTS networks_pkey;
ALTER TABLE networks DROP COLUMN id;
ALTER TABLE networks RENAME COLUMN id_new TO id;
ALTER TABLE networks ADD PRIMARY KEY (id);

-- ---- currencies ----
ALTER TABLE currencies DROP CONSTRAINT IF EXISTS currencies_pkey;
ALTER TABLE currencies DROP COLUMN id;
ALTER TABLE currencies RENAME COLUMN id_new TO id;
ALTER TABLE currencies ADD PRIMARY KEY (id);

-- ---- wallets ----
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_pkey;
ALTER TABLE wallets DROP COLUMN id;
ALTER TABLE wallets RENAME COLUMN id_new TO id;
ALTER TABLE wallets ADD PRIMARY KEY (id);
ALTER TABLE wallets DROP COLUMN user_id;
ALTER TABLE wallets RENAME COLUMN user_id_new TO user_id;
ALTER TABLE wallets DROP COLUMN currency_id;
ALTER TABLE wallets RENAME COLUMN currency_id_new TO currency_id;

-- ---- p2p_ads ----
ALTER TABLE p2p_ads DROP CONSTRAINT IF EXISTS p2p_ads_pkey;
ALTER TABLE p2p_ads DROP COLUMN id;
ALTER TABLE p2p_ads RENAME COLUMN id_new TO id;
ALTER TABLE p2p_ads ADD PRIMARY KEY (id);
ALTER TABLE p2p_ads DROP COLUMN user_id;
ALTER TABLE p2p_ads RENAME COLUMN user_id_new TO user_id;

-- ---- user_profiles ----
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_pkey;
ALTER TABLE user_profiles DROP COLUMN id;
ALTER TABLE user_profiles RENAME COLUMN id_new TO id;
ALTER TABLE user_profiles ADD PRIMARY KEY (id);
ALTER TABLE user_profiles DROP COLUMN user_id;
ALTER TABLE user_profiles RENAME COLUMN user_id_new TO user_id;

-- ---- user_security ----
ALTER TABLE user_security DROP CONSTRAINT IF EXISTS user_security_pkey;
ALTER TABLE user_security DROP COLUMN id;
ALTER TABLE user_security RENAME COLUMN id_new TO id;
ALTER TABLE user_security ADD PRIMARY KEY (id);
ALTER TABLE user_security DROP COLUMN user_id;
ALTER TABLE user_security RENAME COLUMN user_id_new TO user_id;

-- ---- wallet_transactions ----
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_pkey;
ALTER TABLE wallet_transactions DROP COLUMN id;
ALTER TABLE wallet_transactions RENAME COLUMN id_new TO id;
ALTER TABLE wallet_transactions ADD PRIMARY KEY (id);
ALTER TABLE wallet_transactions DROP COLUMN wallet_id;
ALTER TABLE wallet_transactions RENAME COLUMN wallet_id_new TO wallet_id;

-- ---- p2p_orders ----
ALTER TABLE p2p_orders DROP CONSTRAINT IF EXISTS p2p_orders_pkey;
ALTER TABLE p2p_orders DROP COLUMN id;
ALTER TABLE p2p_orders RENAME COLUMN id_new TO id;
ALTER TABLE p2p_orders ADD PRIMARY KEY (id);
ALTER TABLE p2p_orders DROP COLUMN ad_id;
ALTER TABLE p2p_orders RENAME COLUMN ad_id_new TO ad_id;
ALTER TABLE p2p_orders DROP COLUMN buyer_id;
ALTER TABLE p2p_orders RENAME COLUMN buyer_id_new TO buyer_id;
ALTER TABLE p2p_orders DROP COLUMN seller_id;
ALTER TABLE p2p_orders RENAME COLUMN seller_id_new TO seller_id;
ALTER TABLE p2p_orders DROP COLUMN escrow_wallet_id;
ALTER TABLE p2p_orders RENAME COLUMN escrow_wallet_id_new TO escrow_wallet_id;

-- ---- crypto_deposits ----
ALTER TABLE crypto_deposits DROP CONSTRAINT IF EXISTS crypto_deposits_pkey;
ALTER TABLE crypto_deposits DROP COLUMN id;
ALTER TABLE crypto_deposits RENAME COLUMN id_new TO id;
ALTER TABLE crypto_deposits ADD PRIMARY KEY (id);
ALTER TABLE crypto_deposits DROP COLUMN user_id;
ALTER TABLE crypto_deposits RENAME COLUMN user_id_new TO user_id;

-- ---- crypto_withdrawals ----
ALTER TABLE crypto_withdrawals DROP CONSTRAINT IF EXISTS crypto_withdrawals_pkey;
ALTER TABLE crypto_withdrawals DROP COLUMN id;
ALTER TABLE crypto_withdrawals RENAME COLUMN id_new TO id;
ALTER TABLE crypto_withdrawals ADD PRIMARY KEY (id);
ALTER TABLE crypto_withdrawals DROP COLUMN user_id;
ALTER TABLE crypto_withdrawals RENAME COLUMN user_id_new TO user_id;

-- ---- crypto_addresses ----
ALTER TABLE crypto_addresses DROP CONSTRAINT IF EXISTS crypto_addresses_pkey;
ALTER TABLE crypto_addresses DROP COLUMN id;
ALTER TABLE crypto_addresses RENAME COLUMN id_new TO id;
ALTER TABLE crypto_addresses ADD PRIMARY KEY (id);
ALTER TABLE crypto_addresses DROP COLUMN user_id;
ALTER TABLE crypto_addresses RENAME COLUMN user_id_new TO user_id;
ALTER TABLE crypto_addresses DROP COLUMN network_id;
ALTER TABLE crypto_addresses RENAME COLUMN network_id_new TO network_id;
ALTER TABLE crypto_addresses DROP COLUMN currency_id;
ALTER TABLE crypto_addresses RENAME COLUMN currency_id_new TO currency_id;

-- ---- fiat_deposits ----
ALTER TABLE fiat_deposits DROP CONSTRAINT IF EXISTS fiat_deposits_pkey;
ALTER TABLE fiat_deposits DROP COLUMN id;
ALTER TABLE fiat_deposits RENAME COLUMN id_new TO id;
ALTER TABLE fiat_deposits ADD PRIMARY KEY (id);
ALTER TABLE fiat_deposits DROP COLUMN user_id;
ALTER TABLE fiat_deposits RENAME COLUMN user_id_new TO user_id;

-- ---- fiat_withdrawals ----
ALTER TABLE fiat_withdrawals DROP CONSTRAINT IF EXISTS fiat_withdrawals_pkey;
ALTER TABLE fiat_withdrawals DROP COLUMN id;
ALTER TABLE fiat_withdrawals RENAME COLUMN id_new TO id;
ALTER TABLE fiat_withdrawals ADD PRIMARY KEY (id);
ALTER TABLE fiat_withdrawals DROP COLUMN user_id;
ALTER TABLE fiat_withdrawals RENAME COLUMN user_id_new TO user_id;

-- ---- bank_accounts ----
ALTER TABLE bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_pkey;
ALTER TABLE bank_accounts DROP COLUMN id;
ALTER TABLE bank_accounts RENAME COLUMN id_new TO id;
ALTER TABLE bank_accounts ADD PRIMARY KEY (id);
ALTER TABLE bank_accounts DROP COLUMN user_id;
ALTER TABLE bank_accounts RENAME COLUMN user_id_new TO user_id;

-- ---- internal_transfers ----
ALTER TABLE internal_transfers DROP CONSTRAINT IF EXISTS internal_transfers_pkey;
ALTER TABLE internal_transfers DROP COLUMN id;
ALTER TABLE internal_transfers RENAME COLUMN id_new TO id;
ALTER TABLE internal_transfers ADD PRIMARY KEY (id);
ALTER TABLE internal_transfers DROP COLUMN sender_id;
ALTER TABLE internal_transfers RENAME COLUMN sender_id_new TO sender_id;
ALTER TABLE internal_transfers DROP COLUMN receiver_id;
ALTER TABLE internal_transfers RENAME COLUMN receiver_id_new TO receiver_id;

-- ---- notifications ----
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_pkey;
ALTER TABLE notifications DROP COLUMN id;
ALTER TABLE notifications RENAME COLUMN id_new TO id;
ALTER TABLE notifications ADD PRIMARY KEY (id);
ALTER TABLE notifications DROP COLUMN user_id;
ALTER TABLE notifications RENAME COLUMN user_id_new TO user_id;

-- ---- notification_settings ----
ALTER TABLE notification_settings DROP CONSTRAINT IF EXISTS notification_settings_pkey;
ALTER TABLE notification_settings DROP COLUMN id;
ALTER TABLE notification_settings RENAME COLUMN id_new TO id;
ALTER TABLE notification_settings ADD PRIMARY KEY (id);
ALTER TABLE notification_settings DROP COLUMN user_id;
ALTER TABLE notification_settings RENAME COLUMN user_id_new TO user_id;

-- ---- kyc_verifications ----
ALTER TABLE kyc_verifications DROP CONSTRAINT IF EXISTS kyc_verifications_pkey;
ALTER TABLE kyc_verifications DROP COLUMN id;
ALTER TABLE kyc_verifications RENAME COLUMN id_new TO id;
ALTER TABLE kyc_verifications ADD PRIMARY KEY (id);
ALTER TABLE kyc_verifications DROP COLUMN user_id;
ALTER TABLE kyc_verifications RENAME COLUMN user_id_new TO user_id;

-- ============================================================================
-- 5. Set NOT NULL constraints on FK columns.
-- ============================================================================
ALTER TABLE user_profiles       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_security       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE wallets             ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE wallets             ALTER COLUMN currency_id SET NOT NULL;
ALTER TABLE wallet_transactions ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE p2p_ads             ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE p2p_orders          ALTER COLUMN ad_id SET NOT NULL;
ALTER TABLE p2p_orders          ALTER COLUMN buyer_id SET NOT NULL;
ALTER TABLE p2p_orders          ALTER COLUMN seller_id SET NOT NULL;
-- escrow_wallet_id is nullable by design
ALTER TABLE crypto_deposits     ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE crypto_withdrawals  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE crypto_addresses    ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE crypto_addresses    ALTER COLUMN network_id SET NOT NULL;
ALTER TABLE crypto_addresses    ALTER COLUMN currency_id SET NOT NULL;
ALTER TABLE fiat_deposits       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE fiat_withdrawals    ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE bank_accounts       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE internal_transfers  ALTER COLUMN sender_id SET NOT NULL;
ALTER TABLE internal_transfers  ALTER COLUMN receiver_id SET NOT NULL;
ALTER TABLE notifications       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE notification_settings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE kyc_verifications   ALTER COLUMN user_id SET NOT NULL;

-- ============================================================================
-- 6. Set DEFAULT gen_random_uuid() on all id columns.
-- ============================================================================
ALTER TABLE users               ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE networks            ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE currencies          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE wallets             ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE wallet_transactions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE p2p_ads             ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE p2p_orders          ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE crypto_deposits     ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE crypto_withdrawals  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE crypto_addresses    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE fiat_deposits       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE fiat_withdrawals    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE bank_accounts       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE internal_transfers  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notifications       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notification_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE kyc_verifications   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE user_profiles       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE user_security       ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ============================================================================
-- 7. Recreate indexes on FK columns (GORM expects these).
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id       ON user_profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_id_unique ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_security_user_id       ON user_security(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_security_user_id_unique ON user_security(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id             ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_currency_id         ON wallets(currency_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_p2p_ads_user_id             ON p2p_ads(user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_ad_id            ON p2p_orders(ad_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_buyer_id         ON p2p_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_seller_id        ON p2p_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_escrow_wallet_id ON p2p_orders(escrow_wallet_id);
CREATE INDEX IF NOT EXISTS idx_crypto_deposits_user_id     ON crypto_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_withdrawals_user_id  ON crypto_withdrawals(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_network_currency ON crypto_addresses(user_id, network_id, currency_id);
CREATE INDEX IF NOT EXISTS idx_fiat_deposits_user_id       ON fiat_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_fiat_withdrawals_user_id    ON fiat_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id       ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_internal_transfers_sender_id   ON internal_transfers(sender_id);
CREATE INDEX IF NOT EXISTS idx_internal_transfers_receiver_id ON internal_transfers(receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id       ON notifications(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_verifications_user_id ON kyc_verifications(user_id);

-- ============================================================================
-- 8. Drop leftover bigint sequences (auto-increment artifacts).
-- ============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT sequencename
        FROM pg_sequences
        WHERE sequencename LIKE '%_id_seq'
          AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP SEQUENCE IF EXISTS %I CASCADE', r.sequencename);
    END LOOP;
END
$$;

-- ============================================================================
-- 9. Clean up temp mapping tables.
-- ============================================================================
DROP TABLE IF EXISTS _map_users;
DROP TABLE IF EXISTS _map_networks;
DROP TABLE IF EXISTS _map_currencies;
DROP TABLE IF EXISTS _map_wallets;
DROP TABLE IF EXISTS _map_p2p_ads;

COMMIT;

-- Done. After running this, start the server with DB_AUTO_MIGRATE=true to let
-- GORM reconcile any remaining index/constraint naming differences.
