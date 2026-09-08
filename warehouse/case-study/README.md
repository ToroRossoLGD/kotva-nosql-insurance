# SQL Analytics Case Study

This case study answers ten insurance portfolio questions directly against the
PostgreSQL star schema. It is intentionally executable, tenant-filtered, and
currency-safe rather than being a collection of isolated syntax examples.

## Run locally

Start the stack and load the warehouse from ETL Studio, then run:

```powershell
Get-Content warehouse/case-study/queries.sql | docker compose exec -T warehouse psql -U kotva -d kotva_warehouse
```

Alternatively, open `queries.sql` in DBeaver or DataGrip, replace the psql
variable `:'tenant_id'` with a tenant ID, and execute individual questions.

## Skills demonstrated

| Query | Business question | SQL concepts |
|---|---|---|
| Q01 | Overall portfolio health | conditional metrics, safe division |
| Q02 | Monthly premium momentum | CTE, `LAG`, time series |
| Q03 | Which insurer leads? | `DENSE_RANK`, partitioning |
| Q04 | What is the product mix? | nested aggregate window |
| Q05 | Which age cohorts perform best? | dimensional join, segmentation |
| Q06 | Where should collections focus? | `CASE`, business bucketing |
| Q07 | Who beats the tenant benchmark? | window average, variance |
| Q08 | How concentrated is premium? | cumulative window sum, Pareto |
| Q09 | Is insurer concentration risky? | HHI, multi-step aggregation |
| Q10 | Does the BI view reconcile? | control totals, exception query |

Q10 is expected to return zero rows. All monetary questions group or partition
by currency because no exchange-rate table exists. The estimated loss ratio is
based on estimated claim amounts and is not an accounting incurred-loss ratio.

The included fixture represents two tenants so automated execution also guards
against accidentally removing the tenant predicate from the case-study queries.
