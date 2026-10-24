from pathlib import Path
import pandas as pd
import sqlite3

root = Path(__file__).resolve().parents[1]
csv_path = root / "datasets" / "demo" / "school_enrolment_messy.csv"
out = root / "datasets" / "demo" / "school_enrolment_messy.sqlite3"
df = pd.read_csv(csv_path)
with sqlite3.connect(out) as conn:
    df.to_sql("school_enrolment_messy", conn, index=False, if_exists="replace")
print(f"Created {out} with {len(df)} rows")
