CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE distribution_status AS ENUM (
  'draft', 'submitted', 'partially_completed', 'completed', 'failed',
  'ready', 'funded', 'executing', 'cancelled'
);
CREATE TYPE transaction_status AS ENUM ('pending', 'mined', 'reverted');
CREATE TYPE recipient_status AS ENUM ('pending', 'paid', 'failed');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address citext NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  chain_id integer NOT NULL,
  multisend_address citext,
  name text NOT NULL,
  token_address citext NOT NULL,
  token_symbol text NOT NULL,
  token_decimals smallint NOT NULL CHECK (token_decimals BETWEEN 0 AND 36),
  total_amount numeric(78, 0) NOT NULL CHECK (total_amount >= 0),
  recipient_count integer NOT NULL CHECK (recipient_count > 0),
  status distribution_status NOT NULL DEFAULT 'draft',
  csv_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  deleted_at timestamptz,
  kind text NOT NULL DEFAULT 'immediate' CHECK (kind IN ('immediate', 'scheduled')),
  escrow_address citext,
  execute_after timestamptz,
  salt citext,
  CONSTRAINT distributions_escrow_address_matches_kind CHECK (
    (kind = 'immediate' AND escrow_address IS NULL)
    OR (kind = 'scheduled' AND (status = 'draft' OR escrow_address IS NOT NULL))
  ),
  CONSTRAINT distributions_multisend_address_matches_kind CHECK (
    (kind = 'immediate' AND multisend_address IS NOT NULL)
    OR (kind = 'scheduled' AND multisend_address IS NULL)
  )
);

CREATE TABLE distribution_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL REFERENCES distributions(id) ON DELETE CASCADE,
  batch_index integer NOT NULL,
  tx_hash citext,
  status transaction_status NOT NULL DEFAULT 'pending',
  block_number bigint,
  gas_used bigint,
  submitted_at timestamptz,
  mined_at timestamptz,
  UNIQUE (distribution_id, batch_index)
);

CREATE TABLE recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL REFERENCES distributions(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES distribution_transactions(id) ON DELETE SET NULL,
  batch_index integer NOT NULL,
  index_in_batch integer NOT NULL,
  address citext NOT NULL,
  amount numeric(78, 0) NOT NULL CHECK (
    amount >= 1 AND amount <= 340282366920938463463374607431768211455
  ),
  status recipient_status NOT NULL DEFAULT 'pending',
  failure_reason text,
  paid_at timestamptz,
  UNIQUE (distribution_id, batch_index, index_in_batch)
);

CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_address citext NOT NULL,
  token_symbol text NOT NULL,
  token_decimals smallint NOT NULL CHECK (token_decimals BETWEEN 0 AND 36),
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX distributions_user_created_idx ON distributions (user_id, created_at DESC);
CREATE INDEX distributions_status_idx ON distributions (status);
CREATE INDEX distributions_escrow_address_idx
  ON distributions (escrow_address) WHERE escrow_address IS NOT NULL;
CREATE INDEX distribution_transactions_tx_hash_idx ON distribution_transactions (tx_hash);
CREATE INDEX recipients_distribution_status_idx ON recipients (distribution_id, status);
CREATE INDEX recipients_address_idx ON recipients (address);
CREATE INDEX templates_user_created_idx ON templates (user_id, created_at DESC);
