from pathlib import Path

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns


ROOT = Path(__file__).resolve().parents[2]
CSV = ROOT / "data" / "cleaned_historis.csv"
OUT = ROOT / "ml-service" / "reports" / "eda"
REPORT = OUT / "eda_summary.md"


def main():
    data = pd.read_csv(CSV)
    data["tanggal"] = pd.to_datetime(data["tanggal"])
    data["omzet"] = data["total_harga"]
    OUT.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid")

    daily = data.groupby("tanggal", as_index=False)["omzet"].sum()
    monthly = data.assign(month=data["tanggal"].dt.to_period("M").astype(str)).groupby("month", as_index=False)["omzet"].sum()
    top = data.groupby("variant", as_index=False)["quantity"].sum().sort_values("quantity", ascending=False).head(10)
    busy_day = data.assign(day=data["tanggal"].dt.day_name("id_ID")).groupby("day", as_index=False)["omzet"].mean()
    if busy_day.empty:
        busy_day = data.assign(day=data["tanggal"].dt.day_name()).groupby("day", as_index=False)["omzet"].mean()

    plt.figure(figsize=(11, 5))
    plt.plot(daily["tanggal"], daily["omzet"], color="#059669")
    plt.title("Omzet Harian")
    plt.xlabel("Tanggal")
    plt.ylabel("Omzet (Rp)")
    plt.tight_layout()
    plt.savefig(OUT / "omzet_harian.png", dpi=130)
    plt.close()

    plt.figure(figsize=(10, 5))
    sns.barplot(data=monthly, x="month", y="omzet", color="#2563EB")
    plt.title("Omzet Per Bulan")
    plt.xlabel("Bulan")
    plt.ylabel("Omzet (Rp)")
    plt.tight_layout()
    plt.savefig(OUT / "omzet_per_bulan.png", dpi=130)
    plt.close()

    plt.figure(figsize=(11, 5))
    sns.barplot(data=top, y="variant", x="quantity", color="#059669")
    plt.title("Top 10 Varian")
    plt.xlabel("Quantity Terjual")
    plt.ylabel("Varian")
    plt.tight_layout()
    plt.savefig(OUT / "top_10_varian.png", dpi=130)
    plt.close()

    plt.figure(figsize=(10, 5))
    order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    busy_day["day"] = busy_day["day"].replace({"Senin": "Monday", "Selasa": "Tuesday", "Rabu": "Wednesday", "Kamis": "Thursday", "Jumat": "Friday", "Sabtu": "Saturday", "Minggu": "Sunday"})
    busy_day["order"] = busy_day["day"].map({day: i for i, day in enumerate(order)})
    busy_day = busy_day.sort_values("order")
    sns.barplot(data=busy_day, x="day", y="omzet", color="#F59E0B")
    plt.title("Rata-rata Omzet per Hari dalam Minggu")
    plt.xlabel("Hari")
    plt.ylabel("Omzet (Rp)")
    plt.tight_layout()
    plt.savefig(OUT / "rata_rata_omzet_hari_minggu.png", dpi=130)
    plt.close()

    plt.figure(figsize=(10, 5))
    sns.histplot(data["quantity"], bins=20, kde=True, color="#7C3AED")
    plt.title("Distribusi Quantity")
    plt.xlabel("Quantity")
    plt.ylabel("Frekuensi")
    plt.tight_layout()
    plt.savefig(OUT / "distribusi_quantity.png", dpi=130)
    plt.close()

    quantity_stats = data["quantity"].describe()
    total_stats = data["total_harga"].describe()
    monthly_text = "\n".join(
        f"- {month}: Rp{int(total):,}"
        for month, total in monthly.set_index("month")["omzet"].items()
    )

    REPORT.write_text(
        "\n".join([
            "# Ringkasan EDA",
            "",
            "## Statistik deskriptif quantity",
            f"- Mean: {quantity_stats['mean']:.2f}",
            f"- Median: {quantity_stats['50%']:.2f}",
            f"- Std: {quantity_stats['std']:.2f}",
            f"- Min: {quantity_stats['min']:.2f}",
            f"- Max: {quantity_stats['max']:.2f}",
            "",
            "## Statistik deskriptif total harga",
            f"- Mean: {total_stats['mean']:.2f}",
            f"- Median: {total_stats['50%']:.2f}",
            f"- Std: {total_stats['std']:.2f}",
            f"- Min: {total_stats['min']:.2f}",
            f"- Max: {total_stats['max']:.2f}",
            "",
            f"- Jumlah varian: {data['variant'].nunique()}",
            "",
            "## Total omzet per bulan",
            monthly_text,
        ]),
        encoding="utf-8",
    )
    print(f"EDA selesai: {OUT}")


if __name__ == "__main__":
    main()
