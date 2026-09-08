# Kotva Power BI Analytics

This source-controlled semantic model connects Power BI Desktop to the local
PostgreSQL analytics warehouse. It contains a clean star schema, explicit
relationships, reusable DAX measures, and a Kotva report theme.

## Open the model

1. Start the stack with `docker compose up --build -d`.
2. Sign in as `analyst` or `admin` and select **Učitaj warehouse** in ETL Studio.
3. Open Power BI Desktop and enable **Power BI Project (.pbip) save option**.
4. Open `KotvaAnalytics.SemanticModel/model.bim` with Tabular Editor, or create
   a blank PBIP and replace its generated semantic model with this folder.
5. When prompted, authenticate to PostgreSQL at `localhost:5433`, database
   `kotva_warehouse`, user `kotva`, and the configured warehouse password.
6. Refresh the model and import `kotva-theme.json` from **View → Themes**.

The server and database names are model parameters named `PostgreSQLServer`
and `PostgreSQLDatabase`, so they can be changed without editing every query.
Set the `TenantId` parameter before refresh; every imported table is filtered
to that tenant (the default is `kotva-insurance`). Publish separate semantic
models per customer and manage database credentials through the Power BI
gateway rather than embedding them in project files.
The default storage mode is Import for responsive visuals.

## Suggested report pages

### Executive Overview

- Cards: Policy Count, Written Premium, Collection Rate, Estimated Loss Ratio
- Line chart: Date[Month] and Policies[Written Premium]
- Slicers: Date[Year], Policies[Currency], Insurance Type[Insurance Type]

### Insurer Performance

- Matrix: Insurer with Written Premium, Collection Rate, Claim Frequency
- Bar chart: Insurer by Written Premium
- Scatter plot: Collection Rate against Estimated Loss Ratio

### Portfolio Trends

- Line chart: Written Premium and Previous Month Premium by Date
- Waterfall: MoM Premium Growth
- Stacked columns: Insurance Type by Policy Count
- Age Group distribution from the Customer dimension

Financial values must always be filtered to one currency. The warehouse does
not contain exchange rates and intentionally never adds RSD and EUR together.
Customer IDs are tenant-specific pseudonyms; direct identity data is excluded.
