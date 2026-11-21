import json
import sys
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
from sklearn.compose import ColumnTransformer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    mean_absolute_error,
    mean_squared_error,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier, export_text, plot_tree
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sqlalchemy import text


ML_ROOT = Path(__file__).resolve().parents[1]
ROOT = ML_ROOT.parent
sys.path.insert(0, str(ML_ROOT))
from app.settings import create_database_engine, load_environment


MODELS = ML_ROOT / "models"
REPORTS = ML_ROOT / "reports"
FORECAST_PATH = MODELS / "forecast.joblib"
CLASSIFICATION_PATH = MODELS / "classification.joblib"
METRICS_PATH = MODELS / "metrics.json"
CLASS_NAMES = ["tidak laris", "kurang laris", "laris"]
FEATURE_COLUMNS = [
    "variant_name",
    "month",
    "avg_price_per_pc",
    "avg_pack_size",
    "lag1_pcs",
]


def forecast_features(dates: pd.DatetimeIndex, first_date: pd.Timestamp) -> np.ndarray:
    day_features = np.eye(7, dtype=float)[dates.dayofweek]
    trend = (dates - first_date).days.to_numpy(dtype=float).reshape(-1, 1)
    return np.column_stack((day_features, trend))


def class_labels(values: pd.Series | np.ndarray, p33: float, p66: float) -> np.ndarray:
    labels = []
    for value in values:
        if value <= p33:
            labels.append(CLASS_NAMES[0])
        elif value <= p66:
            labels.append(CLASS_NAMES[1])
        else:
            labels.append(CLASS_NAMES[2])
    return np.asarray(labels, dtype=object)


def train_forecast(engine) -> tuple[dict, dict]:
    transactions = pd.read_sql(
        text(
            "SELECT transaction_date, total_amount "
            "FROM transactions WHERE source = 'historis' "
            "ORDER BY transaction_date"
        ),
        engine,
        parse_dates=["transaction_date"],
    )
    if transactions.empty:
        raise RuntimeError("Tidak ada transaksi historis untuk melatih prediksi.")

    transactions["transaction_date"] = transactions["transaction_date"].dt.normalize()
    daily = transactions.groupby("transaction_date")["total_amount"].sum().sort_index()
    first_date = daily.index.min()
    last_date = daily.index.max()
    dates = pd.date_range(first_date, last_date, freq="D")
    daily = daily.reindex(dates, fill_value=0).astype(float)
    values = daily.to_numpy()
    n_days = len(daily)

    forecast_metrics = {
        "status": "insufficient_data",
        "history_start": first_date.date().isoformat(),
        "last_historical_date": last_date.date().isoformat(),
        "days_of_history": n_days,
    }
    if n_days < 30:
        FORECAST_PATH.unlink(missing_ok=True)
        print(f"Forecast dilewati: hanya {n_days} hari historis (minimal 30).")
        return forecast_metrics, {}

    test_size = max(14, int(np.ceil(n_days * 0.20)))
    split_at = n_days - test_size
    train_dates = pd.DatetimeIndex(dates[:split_at])
    test_dates = pd.DatetimeIndex(dates[split_at:])
    x_train = forecast_features(train_dates, first_date)
    x_test = forecast_features(test_dates, first_date)
    y_train = values[:split_at]
    y_test = values[split_at:]

    evaluation_model = LinearRegression()
    evaluation_model.fit(x_train, y_train)
    test_predictions = np.maximum(0, evaluation_model.predict(x_test))
    mae = mean_absolute_error(y_test, test_predictions)
    rmse = float(np.sqrt(mean_squared_error(y_test, test_predictions)))
    r2 = float(evaluation_model.score(x_test, y_test))
    train_mae = mean_absolute_error(y_train, np.maximum(0, evaluation_model.predict(x_train)))

    final_model = LinearRegression()
    final_model.fit(forecast_features(pd.DatetimeIndex(dates), first_date), values)
    history = [
        {"tanggal": date.date().isoformat(), "omzet": int(amount)}
        for date, amount in zip(dates, values)
    ]
    forecast_metrics.update({
        "status": "trained",
        "train_days": split_at,
        "test_days": test_size,
        "mae": float(mae),
        "rmse": rmse,
        "r2": r2,
        "train_mae": float(train_mae),
    })
    artifact = {
        "model": final_model,
        "first_date": first_date.date().isoformat(),
        "last_historical_date": last_date.date().isoformat(),
        "history": history,
    }
    joblib.dump(artifact, FORECAST_PATH)
    print(
        "Forecast: "
        f"MAE={mae:.2f}, RMSE={rmse:.2f}, R2={r2:.4f}, "
        f"train={split_at} hari, test={test_size} hari."
    )
    return forecast_metrics, artifact


def weekly_variant_data(items: pd.DataFrame) -> tuple[pd.DataFrame, dict, list[str]]:
    items = items.copy()
    items["transaction_date"] = pd.to_datetime(items["transaction_date"]).dt.normalize()
    min_date = items["transaction_date"].min()
    max_date = items["transaction_date"].max()
    first_week = min_date + pd.Timedelta(days=(7 - min_date.weekday()) % 7)
    last_sunday = max_date - pd.Timedelta(days=(max_date.weekday() + 1) % 7)
    last_week = last_sunday - pd.Timedelta(days=6)
    all_variants = sorted(items["variant_name"].dropna().unique().tolist())

    if first_week > last_week:
        return pd.DataFrame(), {}, all_variants

    full_weeks = pd.date_range(first_week, last_week, freq="W-MON")
    items["pcs"] = items["qty"].astype(float) * items["pack_size"].fillna(1).astype(float)
    items["week_start"] = items["transaction_date"] - pd.to_timedelta(
        items["transaction_date"].dt.weekday, unit="D"
    )
    items = items[items["week_start"].isin(full_weeks)]
    weekly_sales = items.groupby(["variant_name", "week_start"], as_index=False).agg(
        pcs=("pcs", "sum"),
        revenue=("subtotal", "sum"),
        avg_pack_size=("pack_size", "mean"),
    )

    records = []
    latest_by_variant = {}
    for variant in all_variants:
        sales = weekly_sales[weekly_sales["variant_name"] == variant].set_index("week_start")
        if sales.empty:
            latest_by_variant[variant] = None
            continue

        variant_weeks = full_weeks[full_weeks >= sales.index.min()]
        series = sales.reindex(variant_weeks)
        series["variant_name"] = variant
        series["pcs"] = series["pcs"].fillna(0.0)
        series["avg_price_per_pc"] = (series["revenue"] / series["pcs"]).where(series["pcs"] > 0)
        series["avg_price_per_pc"] = series["avg_price_per_pc"].ffill()
        series["avg_pack_size"] = series["avg_pack_size"].ffill()
        series["month"] = series.index.month
        series["lag1_pcs"] = series["pcs"].shift(1)
        latest_by_variant[variant] = series.iloc[-1]

        trainable = series.dropna(subset=["lag1_pcs", "avg_price_per_pc", "avg_pack_size"])
        for week_start, row in trainable.iterrows():
            records.append({
                "variant_name": variant,
                "week_start": week_start,
                "month": int(row["month"]),
                "avg_price_per_pc": float(row["avg_price_per_pc"]),
                "avg_pack_size": float(row["avg_pack_size"]),
                "lag1_pcs": float(row["lag1_pcs"]),
                "pcs": float(row["pcs"]),
            })

    return pd.DataFrame(records), latest_by_variant, all_variants


def train_classification(engine) -> tuple[dict, dict]:
    items = pd.read_sql(
        text(
            "SELECT t.transaction_date, pv.variant_name, ti.qty, ti.subtotal, "
            "COALESCE(pv.pack_size, 1) AS pack_size "
            "FROM transactions t "
            "JOIN transaction_items ti ON ti.transaction_id = t.id "
            "JOIN product_variants pv ON pv.id = ti.product_variant_id "
            "WHERE t.source = 'historis' "
            "ORDER BY t.transaction_date"
        ),
        engine,
        parse_dates=["transaction_date"],
    )
    if items.empty:
        raise RuntimeError("Tidak ada item historis untuk melatih klasifikasi.")

    weekly, latest_by_variant, all_variants = weekly_variant_data(items)
    week_counts = {
        variant: sum(
            1 for row in weekly.get("variant_name", pd.Series(dtype=str))
            if row == variant
        ) + 1
        for variant in all_variants
    }
    excluded_variants = sorted(
        variant for variant in all_variants if week_counts.get(variant, 0) < 4
    )
    eligible_variants = [variant for variant in all_variants if variant not in excluded_variants]
    training = weekly[weekly["variant_name"].isin(eligible_variants)].copy() if not weekly.empty else weekly

    metrics = {
        "status": "insufficient_data",
        "eligible_variant_count": len(eligible_variants),
        "excluded_variant_count": len(excluded_variants),
        "excluded_variants": excluded_variants,
        "weekly_rows": int(len(training)),
        "message": "Data mingguan belum cukup untuk melatih klasifikasi.",
    }
    if len(training) < 10:
        CLASSIFICATION_PATH.unlink(missing_ok=True)
        print("Klasifikasi dilewati: jumlah baris mingguan kurang dari 10.")
        return metrics, {}

    pcs_values = training["pcs"].to_numpy(dtype=float)
    provisional_p33, provisional_p66 = np.percentile(pcs_values, [33, 66])
    provisional_labels = class_labels(pcs_values, provisional_p33, provisional_p66)
    class_counts = pd.Series(provisional_labels).value_counts()
    if len(class_counts) < 2 or class_counts.min() < 2:
        metrics["message"] = "Jumlah contoh per kelas belum cukup untuk split stratifikasi."
        CLASSIFICATION_PATH.unlink(missing_ok=True)
        print(metrics["message"])
        return metrics, {}

    indices = np.arange(len(training))
    train_indices, test_indices = train_test_split(
        indices,
        test_size=0.20,
        random_state=42,
        stratify=provisional_labels,
    )
    train_rows = training.iloc[train_indices]
    test_rows = training.iloc[test_indices]
    p33, p66 = np.percentile(train_rows["pcs"], [33, 66])
    y_train = class_labels(train_rows["pcs"].to_numpy(), p33, p66)
    y_test = class_labels(test_rows["pcs"].to_numpy(), p33, p66)

    preprocessor = ColumnTransformer(
        transformers=[
            ("variant", OneHotEncoder(handle_unknown="ignore"), ["variant_name"]),
            ("month", OneHotEncoder(
                categories=[list(range(1, 13))],
                handle_unknown="ignore",
            ), ["month"]),
            ("numeric", "passthrough", ["avg_price_per_pc", "avg_pack_size", "lag1_pcs"]),
        ],
        verbose_feature_names_out=False,
    )
    classifier = DecisionTreeClassifier(
        max_depth=4,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=42,
    )
    pipeline = Pipeline([("features", preprocessor), ("classifier", classifier)])
    x_train = train_rows[FEATURE_COLUMNS]
    x_test = test_rows[FEATURE_COLUMNS]
    pipeline.fit(x_train, y_train)
    train_predictions = pipeline.predict(x_train)
    test_predictions = pipeline.predict(x_test)

    feature_names = pipeline.named_steps["features"].get_feature_names_out().tolist()
    tree = pipeline.named_steps["classifier"]
    importances = sorted(
        [
            {"feature": name, "importance": float(importance)}
            for name, importance in zip(feature_names, tree.feature_importances_)
        ],
        key=lambda item: item["importance"],
        reverse=True,
    )
    rules = export_text(tree, feature_names=feature_names, decimals=2)
    cm = confusion_matrix(y_test, test_predictions, labels=CLASS_NAMES)
    report = classification_report(
        y_test,
        test_predictions,
        labels=CLASS_NAMES,
        output_dict=True,
        zero_division=0,
    )

    product_results = []
    for variant in all_variants:
        latest = latest_by_variant.get(variant)
        if variant in excluded_variants or latest is None:
            product_results.append({
                "variant_name": variant,
                "kelas_aktual_minggu_terakhir": "Data belum cukup",
                "prediksi_minggu_depan": "Data belum cukup",
            })
            continue

        actual = class_labels(np.asarray([latest["pcs"]]), p33, p66)[0]
        next_week = pd.Timestamp(latest.name) + pd.Timedelta(days=7)
        next_features = pd.DataFrame([{
            "variant_name": variant,
            "month": int(next_week.month),
            "avg_price_per_pc": float(latest["avg_price_per_pc"]),
            "avg_pack_size": float(latest["avg_pack_size"]),
            "lag1_pcs": float(latest["pcs"]),
        }])
        predicted = pipeline.predict(next_features[FEATURE_COLUMNS])[0]
        product_results.append({
            "variant_name": variant,
            "kelas_aktual_minggu_terakhir": str(actual),
            "prediksi_minggu_depan": str(predicted),
        })

    metrics.update({
        "status": "trained",
        "message": None,
        "weekly_rows": int(len(training)),
        "training_rows": int(len(train_rows)),
        "testing_rows": int(len(test_rows)),
        "thresholds": {"p33": float(p33), "p66": float(p66)},
        "accuracy_train": float(accuracy_score(y_train, train_predictions)),
        "accuracy_test": float(accuracy_score(y_test, test_predictions)),
        "confusion_matrix": {
            "labels": CLASS_NAMES,
            "values": cm.astype(int).tolist(),
        },
        "classification_report": report,
        "feature_importance": importances,
        "tree_rules": rules,
    })

    sns.set_theme(style="white")
    plt.figure(figsize=(7, 6))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Greens",
        xticklabels=CLASS_NAMES,
        yticklabels=CLASS_NAMES,
    )
    plt.xlabel("Prediksi")
    plt.ylabel("Aktual")
    plt.title("Confusion Matrix Klasifikasi Produk")
    plt.tight_layout()
    plt.savefig(REPORTS / "confusion_matrix.png", dpi=150)
    plt.close()

    plt.figure(figsize=(20, 12))
    plot_tree(
        tree,
        feature_names=feature_names,
        class_names=CLASS_NAMES,
        filled=True,
        rounded=True,
        fontsize=7,
    )
    plt.title("Decision Tree Kinerja Produk")
    plt.tight_layout()
    plt.savefig(REPORTS / "decision_tree.png", dpi=150)
    plt.close()

    artifact = {
        "model": pipeline,
        "thresholds": metrics["thresholds"],
        "products": product_results,
    }
    joblib.dump(artifact, CLASSIFICATION_PATH)
    print(
        f"Klasifikasi: train accuracy={metrics['accuracy_train']:.4f}, "
        f"test accuracy={metrics['accuracy_test']:.4f}; "
        f"{len(excluded_variants)} varian dikecualikan."
    )
    return metrics, artifact


def main() -> None:
    load_environment()
    MODELS.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    engine = create_database_engine()
    try:
        forecast_metrics, _ = train_forecast(engine)
        classification_metrics, _ = train_classification(engine)
    finally:
        engine.dispose()

    metrics = {
        "generated_at": pd.Timestamp.now(tz="Asia/Jakarta").isoformat(),
        "data_source": "transactions.source='historis'",
        "forecast": forecast_metrics,
        "classification": classification_metrics,
    }
    METRICS_PATH.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    report_lines = [
        "# Evaluasi Model Sava",
        "",
        "## Prediksi omzet harian",
        "",
        f"- Status: {forecast_metrics['status']}",
        f"- Rentang historis: {forecast_metrics['history_start']} sampai {forecast_metrics['last_historical_date']}",
        f"- Jumlah hari dalam seri (hari tanpa transaksi diisi 0): {forecast_metrics['days_of_history']}",
    ]
    if forecast_metrics["status"] == "trained":
        report_lines.extend([
            f"- MAE: Rp{forecast_metrics['mae']:,.2f}",
            f"- RMSE: Rp{forecast_metrics['rmse']:,.2f}",
            f"- R²: {forecast_metrics['r2']:.4f}",
            f"- Split kronologis: {forecast_metrics['train_days']} hari latih, {forecast_metrics['test_days']} hari uji.",
            f"- Interpretasi: galat rata-rata sekitar Rp{forecast_metrics['mae']:,.0f} per hari; R² {forecast_metrics['r2']:.4f} menunjukkan model belum kuat menjelaskan perubahan omzet.",
        ])
    report_lines.extend([
        "",
        "Prediksi dimulai sehari setelah tanggal historis terakhir; tanggal historis terakhir tetap menjadi titik aktual terakhir pada grafik.",
        "",
        "## Klasifikasi kinerja produk",
        "",
        f"- Status: {classification_metrics['status']}",
        f"- Baris varian-minggu yang digunakan: {classification_metrics['weekly_rows']}",
        f"- Jumlah varian dikecualikan karena memiliki kurang dari 4 minggu data: {classification_metrics['excluded_variant_count']}",
        f"- Nama varian dikecualikan: {', '.join(classification_metrics['excluded_variants']) or 'Tidak ada'}",
    ])
    if classification_metrics["status"] == "trained":
        report_lines.extend([
            f"- Akurasi latih: {classification_metrics['accuracy_train']:.4f}",
            f"- Akurasi uji: {classification_metrics['accuracy_test']:.4f}",
            f"- Batas kelas (dihitung dari baris latih): P33={classification_metrics['thresholds']['p33']:.2f} pcs, P66={classification_metrics['thresholds']['p66']:.2f} pcs.",
            "- Interpretasi: akurasi uji masih sedang dan lebih rendah daripada akurasi latih; hasil belum cukup kuat untuk dianggap kepastian.",
            "- Confusion matrix dan pohon tersimpan di `reports/confusion_matrix.png` dan `reports/decision_tree.png`.",
        ])
    else:
        report_lines.append(f"- Catatan: {classification_metrics['message']}")
    report_lines.extend([
        "",
        "## Keterbatasan",
        "",
        "- Dataset historis terbatas dan ditulis manual; metrik evaluasi perlu dibaca sebagai indikasi, bukan jaminan hasil masa depan.",
        "- Jumlah data yang kecil membuat akurasi cenderung sedang; tambah data historis sebelum mengandalkan prediksi atau klasifikasi untuk keputusan usaha.",
        "- Varian dengan kurang dari 4 minggu data tidak dilatih dan ditandai `Data belum cukup` pada keluaran klasifikasi.",
    ])
    (REPORTS / "evaluation.md").write_text("\n".join(report_lines), encoding="utf-8")
    print(f"Metrik tersimpan: {METRICS_PATH}")
    print(f"Evaluasi tersimpan: {REPORTS / 'evaluation.md'}")


if __name__ == "__main__":
    main()
