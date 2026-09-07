# Kotva portfolio analysis

This folder contains a reproducible Jupyter analysis of the anonymized dataset
produced by Kotva's ETL module. The committed notebook includes outputs so its
tables, charts, and conclusions are visible directly on GitHub.

## Run locally

From the repository root:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r analytics/requirements.txt
jupyter lab analytics/kotva_portfolio_analysis.ipynb
```

The notebook uses `analytics/data/sample_analytics_dataset.csv` by default. To
analyze a fresh export from the application, set `KOTVA_DATASET` before starting
Jupyter:

```powershell
$env:KOTVA_DATASET = "C:\path\to\kotva-analytics-dataset-2026-09-08.csv"
jupyter lab analytics/kotva_portfolio_analysis.ipynb
```

The expected input is the `analytics-dataset.csv` file available in the ETL
Studio. It contains pseudonymous customer IDs and excludes names, JMBG values,
passport numbers, and free-text claim descriptions.

## Analysis scope

- schema and missing-value validation;
- written, collected, and outstanding premium by currency;
- collection rate and estimated loss ratio;
- monthly seasonality and year-over-year comparison;
- insurer performance benchmarking;
- insurance-type and age-group segmentation;
- premium-versus-age relationship;
- claim frequency and severity;
- evidence-based business recommendations.

Financial totals are never combined across currencies. Estimated loss ratio is
used as an analytical proxy because the source application does not yet model
earned premium, claim reserves, or incurred-but-not-reported losses.

