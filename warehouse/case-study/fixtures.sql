INSERT INTO dim_date VALUES
  (20260115, '2026-01-15', 2026, 1, 1, 'January', 15),
  (20260215, '2026-02-15', 2026, 1, 2, 'February', 15),
  (20260315, '2026-03-15', 2026, 1, 3, 'March', 15),
  (20260320, '2026-03-20', 2026, 1, 3, 'March', 20);

INSERT INTO dim_customer(customer_key, tenant_id, customer_id, age, age_group) VALUES
  (1, 'kotva-insurance', 'CUST-A001', 24, '18-25'),
  (2, 'kotva-insurance', 'CUST-A002', 42, '36-45'),
  (3, 'kotva-insurance', 'CUST-A003', 61, '56-65'),
  (4, 'adria-brokers', 'CUST-B001', 35, '26-35');

INSERT INTO dim_insurer(insurer_key, tenant_id, insurer_name) VALUES
  (1, 'kotva-insurance', 'Uniqa'), (2, 'kotva-insurance', 'Generali'),
  (3, 'adria-brokers', 'Sava');

INSERT INTO dim_insurance_type(insurance_type_key, tenant_id, insurance_type) VALUES
  (1, 'kotva-insurance', 'Putno'), (2, 'kotva-insurance', 'Auto'),
  (3, 'kotva-insurance', 'Životno'), (4, 'adria-brokers', 'Auto');

INSERT INTO fact_policies(policy_key, tenant_id, policy_number, customer_key, insurer_key,
  insurance_type_key, sale_date_key, valid_from_date_key, valid_until_date_key, premium,
  currency, policy_status, payment_status) VALUES
  (1, 'kotva-insurance', 'POL-A001', 1, 1, 1, 20260115, 20260115, 20260315, 100, 'EUR', 'Aktivna', 'Plaćeno'),
  (2, 'kotva-insurance', 'POL-A002', 2, 2, 2, 20260215, 20260215, 20260320, 300, 'EUR', 'Aktivna', 'Delimično plaćeno'),
  (3, 'kotva-insurance', 'POL-A003', 3, 1, 3, 20260315, 20260315, 20260320, 200, 'EUR', 'Otkazana', 'Nije plaćeno'),
  (4, 'adria-brokers', 'POL-B001', 4, 3, 4, 20260315, 20260315, 20260320, 9000, 'RSD', 'Aktivna', 'Plaćeno');

INSERT INTO fact_payments(payment_key, tenant_id, receipt_number, policy_key, payment_date_key,
  amount, currency, payment_method) VALUES
  (1, 'kotva-insurance', 'PAY-A001', 1, 20260115, 100, 'EUR', 'Kartica'),
  (2, 'kotva-insurance', 'PAY-A002', 2, 20260315, 120, 'EUR', 'Bankovni transfer'),
  (3, 'adria-brokers', 'PAY-B001', 4, 20260320, 9000, 'RSD', 'Kartica');

INSERT INTO fact_claims(claim_key, tenant_id, claim_number, policy_key, incident_date_key,
  estimated_amount, currency, claim_status) VALUES
  (1, 'kotva-insurance', 'CLM-A001', 2, 20260315, 75, 'EUR', 'U obradi'),
  (2, 'adria-brokers', 'CLM-B001', 4, 20260320, 1000, 'RSD', 'Prijavljena');

