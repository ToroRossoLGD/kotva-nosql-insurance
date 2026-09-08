-- Kotva SQL analytics case study
-- Change this value to analyze another tenant. Every query also separates currencies.
\set tenant_id 'kotva-insurance'

-- Q01 Executive portfolio summary by currency.
SELECT currency, COUNT(*) AS policy_count, SUM(premium) AS written_premium,
       SUM(collected_premium) AS collected_premium,
       ROUND(100 * SUM(collected_premium) / NULLIF(SUM(premium), 0), 2) AS collection_rate,
       ROUND(100 * SUM(estimated_claims) / NULLIF(SUM(premium), 0), 2) AS estimated_loss_ratio
FROM bi_policy_performance WHERE tenant_id = :'tenant_id'
GROUP BY currency ORDER BY currency;

-- Q02 Monthly written-premium trend and month-over-month growth.
WITH monthly AS (
  SELECT d.calendar_year, d.calendar_month, p.currency, SUM(p.premium) AS premium
  FROM fact_policies p JOIN dim_date d ON d.date_key = p.sale_date_key
  WHERE p.tenant_id = :'tenant_id'
  GROUP BY d.calendar_year, d.calendar_month, p.currency
), compared AS (
  SELECT *, LAG(premium) OVER (PARTITION BY currency ORDER BY calendar_year, calendar_month) AS previous_premium
  FROM monthly
)
SELECT *, ROUND(100 * (premium - previous_premium) / NULLIF(previous_premium, 0), 2) AS mom_growth_pct
FROM compared ORDER BY calendar_year, calendar_month, currency;

-- Q03 Insurer ranking inside each currency.
SELECT insurer_name, currency, policy_count, written_premium, collection_rate,
       estimated_loss_ratio,
       DENSE_RANK() OVER (PARTITION BY currency ORDER BY written_premium DESC) AS premium_rank
FROM vw_insurer_performance WHERE tenant_id = :'tenant_id'
ORDER BY currency, premium_rank, insurer_name;

-- Q04 Product mix and each product's share of tenant policies.
SELECT t.insurance_type, COUNT(*) AS policies,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS portfolio_share_pct
FROM fact_policies p
JOIN dim_insurance_type t ON t.insurance_type_key = p.insurance_type_key
WHERE p.tenant_id = :'tenant_id'
GROUP BY t.insurance_type ORDER BY policies DESC;

-- Q05 Customer age-cohort performance.
SELECT c.age_group, p.currency, COUNT(*) AS policies,
       ROUND(AVG(p.premium), 2) AS average_premium,
       ROUND(100.0 * SUM(p.claim_count) / NULLIF(COUNT(*), 0), 2) AS claim_frequency_pct
FROM bi_policy_performance p JOIN dim_customer c ON c.customer_key = p.customer_key
WHERE p.tenant_id = :'tenant_id'
GROUP BY c.age_group, p.currency ORDER BY p.currency, c.age_group;

-- Q06 Outstanding-premium segmentation for collection prioritization.
SELECT CASE WHEN outstanding_premium = 0 THEN 'Paid'
            WHEN outstanding_premium <= premium * 0.25 THEN 'Up to 25% outstanding'
            WHEN outstanding_premium <= premium * 0.75 THEN '25-75% outstanding'
            ELSE 'Over 75% outstanding' END AS collection_bucket,
       currency, COUNT(*) AS policies, SUM(outstanding_premium) AS outstanding_value
FROM bi_policy_performance WHERE tenant_id = :'tenant_id'
GROUP BY collection_bucket, currency ORDER BY currency, outstanding_value DESC;

-- Q07 Insurer performance against tenant averages.
WITH performance AS (
  SELECT * FROM vw_insurer_performance WHERE tenant_id = :'tenant_id'
)
SELECT insurer_name, currency, collection_rate, estimated_loss_ratio,
       ROUND(AVG(collection_rate) OVER (PARTITION BY currency), 2) AS tenant_avg_collection_rate,
       collection_rate - AVG(collection_rate) OVER (PARTITION BY currency) AS collection_rate_gap
FROM performance ORDER BY currency, collection_rate DESC;

-- Q08 Cumulative premium contribution (Pareto analysis).
WITH insurer_premium AS (
  SELECT tenant_id, insurer_name, currency, written_premium
  FROM vw_insurer_performance WHERE tenant_id = :'tenant_id'
)
SELECT insurer_name, currency, written_premium,
       ROUND(100 * SUM(written_premium) OVER (PARTITION BY currency ORDER BY written_premium DESC, insurer_name ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) /
         NULLIF(SUM(written_premium) OVER (PARTITION BY currency), 0), 2) AS cumulative_share_pct
FROM insurer_premium ORDER BY currency, written_premium DESC;

-- Q09 Portfolio concentration using the Herfindahl-Hirschman Index.
WITH shares AS (
  SELECT currency, insurer_name,
         written_premium / NULLIF(SUM(written_premium) OVER (PARTITION BY currency), 0) AS share
  FROM vw_insurer_performance WHERE tenant_id = :'tenant_id'
)
SELECT currency, ROUND(SUM(POWER(share * 100, 2)), 2) AS hhi,
       CASE WHEN SUM(POWER(share * 100, 2)) < 1500 THEN 'Low concentration'
            WHEN SUM(POWER(share * 100, 2)) <= 2500 THEN 'Moderate concentration'
            ELSE 'High concentration' END AS concentration_band
FROM shares GROUP BY currency ORDER BY currency;

-- Q10 Reconcile policy-level metrics with the base fact tables.
SELECT p.currency, COUNT(*) AS policies,
       SUM(p.premium) AS base_written_premium,
       SUM(b.premium) AS bi_written_premium,
       SUM(p.premium) - SUM(b.premium) AS reconciliation_difference
FROM fact_policies p JOIN bi_policy_performance b ON b.policy_key = p.policy_key
WHERE p.tenant_id = :'tenant_id'
GROUP BY p.currency HAVING SUM(p.premium) <> SUM(b.premium) OR COUNT(*) = 0;
