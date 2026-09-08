CREATE TABLE IF NOT EXISTS dim_date (
  date_key INTEGER PRIMARY KEY,
  full_date DATE NOT NULL UNIQUE,
  calendar_year SMALLINT NOT NULL,
  calendar_quarter SMALLINT NOT NULL CHECK (calendar_quarter BETWEEN 1 AND 4),
  calendar_month SMALLINT NOT NULL CHECK (calendar_month BETWEEN 1 AND 12),
  month_name VARCHAR(12) NOT NULL,
  day_of_month SMALLINT NOT NULL CHECK (day_of_month BETWEEN 1 AND 31)
);

CREATE TABLE IF NOT EXISTS dim_customer (
  customer_key BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(80) NOT NULL,
  customer_id VARCHAR(40) NOT NULL,
  age SMALLINT NOT NULL CHECK (age BETWEEN 0 AND 120),
  age_group VARCHAR(12) NOT NULL,
  UNIQUE (tenant_id, customer_id)
);

CREATE TABLE IF NOT EXISTS dim_insurer (
  insurer_key BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(80) NOT NULL,
  insurer_name VARCHAR(100) NOT NULL,
  UNIQUE (tenant_id, insurer_name)
);

CREATE TABLE IF NOT EXISTS dim_insurance_type (
  insurance_type_key BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(80) NOT NULL,
  insurance_type VARCHAR(80) NOT NULL,
  UNIQUE (tenant_id, insurance_type)
);

CREATE TABLE IF NOT EXISTS fact_policies (
  policy_key BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(80) NOT NULL,
  policy_number VARCHAR(140) NOT NULL,
  customer_key BIGINT NOT NULL REFERENCES dim_customer(customer_key),
  insurer_key BIGINT NOT NULL REFERENCES dim_insurer(insurer_key),
  insurance_type_key BIGINT NOT NULL REFERENCES dim_insurance_type(insurance_type_key),
  sale_date_key INTEGER NOT NULL REFERENCES dim_date(date_key),
  valid_from_date_key INTEGER NOT NULL REFERENCES dim_date(date_key),
  valid_until_date_key INTEGER NOT NULL REFERENCES dim_date(date_key),
  premium NUMERIC(18,2) NOT NULL CHECK (premium >= 0),
  currency CHAR(3) NOT NULL,
  policy_status VARCHAR(40) NOT NULL,
  payment_status VARCHAR(40) NOT NULL,
  source_updated_at TIMESTAMPTZ,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, policy_number)
);

CREATE TABLE IF NOT EXISTS fact_payments (
  payment_key BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(80) NOT NULL,
  receipt_number VARCHAR(140) NOT NULL,
  policy_key BIGINT NOT NULL REFERENCES fact_policies(policy_key),
  payment_date_key INTEGER NOT NULL REFERENCES dim_date(date_key),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  payment_method VARCHAR(60) NOT NULL,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS fact_claims (
  claim_key BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(80) NOT NULL,
  claim_number VARCHAR(140) NOT NULL,
  policy_key BIGINT NOT NULL REFERENCES fact_policies(policy_key),
  incident_date_key INTEGER NOT NULL REFERENCES dim_date(date_key),
  estimated_amount NUMERIC(18,2) NOT NULL CHECK (estimated_amount > 0),
  currency CHAR(3) NOT NULL,
  claim_status VARCHAR(40) NOT NULL,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, claim_number)
);

CREATE TABLE IF NOT EXISTS warehouse_loads (
  load_id VARCHAR(140) PRIMARY KEY,
  tenant_id VARCHAR(80) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL,
  policy_rows INTEGER NOT NULL,
  payment_rows INTEGER NOT NULL,
  claim_rows INTEGER NOT NULL,
  initiated_by VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fact_policies_tenant_sale ON fact_policies (tenant_id, sale_date_key);
CREATE INDEX IF NOT EXISTS idx_fact_policies_tenant_insurer ON fact_policies (tenant_id, insurer_key);
CREATE INDEX IF NOT EXISTS idx_fact_payments_tenant_date ON fact_payments (tenant_id, payment_date_key);
CREATE INDEX IF NOT EXISTS idx_fact_claims_tenant_date ON fact_claims (tenant_id, incident_date_key);
CREATE INDEX IF NOT EXISTS idx_warehouse_loads_tenant_time ON warehouse_loads (tenant_id, completed_at DESC);

CREATE OR REPLACE VIEW vw_monthly_portfolio AS
SELECT p.tenant_id, d.calendar_year, d.calendar_quarter, d.calendar_month,
       p.currency, COUNT(*) AS policy_count, SUM(p.premium) AS written_premium
FROM fact_policies p
JOIN dim_date d ON d.date_key = p.sale_date_key
GROUP BY p.tenant_id, d.calendar_year, d.calendar_quarter, d.calendar_month, p.currency;

CREATE OR REPLACE VIEW vw_insurer_performance AS
WITH policy_totals AS (
  SELECT p.tenant_id, p.insurer_key, p.currency, COUNT(*) AS policy_count,
         SUM(p.premium) AS written_premium
  FROM fact_policies p
  GROUP BY p.tenant_id, p.insurer_key, p.currency
), payment_totals AS (
  SELECT p.tenant_id, p.insurer_key, pay.currency, SUM(pay.amount) AS collected_premium
  FROM fact_payments pay JOIN fact_policies p ON p.policy_key = pay.policy_key
  GROUP BY p.tenant_id, p.insurer_key, pay.currency
), claim_totals AS (
  SELECT p.tenant_id, p.insurer_key, c.currency, COUNT(*) AS claim_count,
         SUM(c.estimated_amount) AS estimated_claims
  FROM fact_claims c JOIN fact_policies p ON p.policy_key = c.policy_key
  GROUP BY p.tenant_id, p.insurer_key, c.currency
)
SELECT pt.tenant_id, i.insurer_name, pt.currency, pt.policy_count,
       pt.written_premium, COALESCE(pay.collected_premium, 0) AS collected_premium,
       COALESCE(cl.claim_count, 0) AS claim_count,
       COALESCE(cl.estimated_claims, 0) AS estimated_claims,
       ROUND(100 * COALESCE(pay.collected_premium, 0) / NULLIF(pt.written_premium, 0), 2) AS collection_rate,
       ROUND(100 * COALESCE(cl.estimated_claims, 0) / NULLIF(pt.written_premium, 0), 2) AS estimated_loss_ratio
FROM policy_totals pt
JOIN dim_insurer i ON i.insurer_key = pt.insurer_key
LEFT JOIN payment_totals pay ON pay.tenant_id = pt.tenant_id AND pay.insurer_key = pt.insurer_key AND pay.currency = pt.currency
LEFT JOIN claim_totals cl ON cl.tenant_id = pt.tenant_id AND cl.insurer_key = pt.insurer_key AND cl.currency = pt.currency;

CREATE OR REPLACE VIEW bi_policy_performance AS
SELECT p.policy_key, p.tenant_id, p.policy_number, p.customer_key, p.insurer_key,
       p.insurance_type_key, p.sale_date_key, p.premium, p.currency,
       p.policy_status, p.payment_status,
       COALESCE(pay.collected_premium, 0) AS collected_premium,
       p.premium - COALESCE(pay.collected_premium, 0) AS outstanding_premium,
       COALESCE(cl.claim_count, 0) AS claim_count,
       COALESCE(cl.estimated_claims, 0) AS estimated_claims
FROM fact_policies p
LEFT JOIN (
  SELECT policy_key, SUM(amount) AS collected_premium
  FROM fact_payments GROUP BY policy_key
) pay ON pay.policy_key = p.policy_key
LEFT JOIN (
  SELECT policy_key, COUNT(*) AS claim_count, SUM(estimated_amount) AS estimated_claims
  FROM fact_claims GROUP BY policy_key
) cl ON cl.policy_key = p.policy_key;

