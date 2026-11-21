import logging
import json
from contextlib import asynccontextmanager
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
from sqlalchemy import text

from app.settings import ML_ROOT, create_database_engine, load_environment


logger = logging.getLogger("sava.ml")
MODELS = ML_ROOT / "models"
FORECAST_PATH = MODELS / "forecast.joblib"
CLASSIFICATION_PATH = MODELS / "classification.joblib"
METRICS_PATH = MODELS / "metrics.json"


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_environment()
    missing = [
        path.name
        for path in (FORECAST_PATH, CLASSIFICATION_PATH, METRICS_PATH)
        if not path.is_file()
    ]
    if missing:
        app.state.model_error = "Model belum tersedia. Jalankan scripts/train.py terlebih dahulu."
        app.state.forecast = None
        app.state.classification = None
        app.state.metrics = None
    else:
        try:
            app.state.forecast = joblib.load(FORECAST_PATH)
            app.state.classification = joblib.load(CLASSIFICATION_PATH)
            app.state.metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
            app.state.model_error = None
        except Exception as error:
            logger.exception("Gagal memuat model ML.")
            app.state.model_error = f"Model gagal dimuat: {error}"
            app.state.forecast = None
            app.state.classification = None
            app.state.metrics = None
    app.state.engine = None
    try:
        yield
    finally:
        if app.state.engine is not None:
            app.state.engine.dispose()


app = FastAPI(title="Sava ML Service", version="1.0.0", lifespan=lifespan)


def require_models(request: Request) -> None:
    if request.app.state.model_error:
        raise HTTPException(status_code=503, detail=request.app.state.model_error)


def get_engine(request: Request):
    if request.app.state.engine is None:
        try:
            request.app.state.engine = create_database_engine()
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
    return request.app.state.engine


@app.get("/health")
def health(request: Request):
    if request.app.state.model_error:
        raise HTTPException(status_code=503, detail=request.app.state.model_error)
    return {"status": "ok", "models_loaded": True}


@app.get("/forecast")
def forecast(
    request: Request,
    days: int = Query(default=7, ge=1, le=90),
):
    require_models(request)
    artifact = request.app.state.forecast
    metric = request.app.state.metrics["forecast"]
    if metric["status"] != "trained":
        raise HTTPException(status_code=503, detail="Data historis belum cukup untuk prediksi.")

    last_date = pd.Timestamp(artifact["last_historical_date"])
    first_date = pd.Timestamp(artifact["first_date"])
    future_dates = pd.date_range(last_date + pd.Timedelta(days=1), periods=days, freq="D")
    features = []
    for date in future_dates:
        row = {f"day_{day}": int(date.dayofweek == day) for day in range(7)}
        row["t"] = (date - first_date).days
        features.append(list(row.values()))
    predictions = artifact["model"].predict(features).clip(min=0)
    history = artifact["history"][-30:]

    return {
        "history": history,
        "forecast": [
            {"tanggal": date.date().isoformat(), "omzet": int(round(float(amount)))}
            for date, amount in zip(future_dates, predictions)
        ],
        "metrics": metric,
    }


@app.get("/classification")
def classification(request: Request):
    require_models(request)
    metric = request.app.state.metrics["classification"]
    if metric["status"] != "trained":
        raise HTTPException(status_code=503, detail=metric.get("message") or "Model klasifikasi belum tersedia.")

    return {
        "products": request.app.state.classification["products"],
        "thresholds": metric["thresholds"],
        "metrics": metric,
        "tree_rules": metric["tree_rules"],
        "feature_importance": metric["feature_importance"],
    }


@app.get("/bundling")
def bundling(
    request: Request,
    basis: Literal["day", "transaction"] = Query(default="day"),
):
    require_models(request)
    if basis == "day":
        sources = ["historis"]
    else:
        sources = ["simulasi", "kasir"]

    engine = get_engine(request)
    baskets = pd.read_sql(
        text(
            "SELECT t.basket_key, pv.variant_name "
            "FROM transactions t "
            "JOIN transaction_items ti ON ti.transaction_id = t.id "
            "JOIN product_variants pv ON pv.id = ti.product_variant_id "
            "WHERE t.source = ANY(:sources) "
            "ORDER BY t.basket_key, pv.variant_name"
        ),
        engine,
        params={"sources": sources},
    )
    if baskets.empty:
        return {"basis": basis, "data": [], "message": "Belum ditemukan pola yang kuat."}

    transaction_lists = (
        baskets.groupby("basket_key")["variant_name"]
        .apply(lambda values: sorted(set(values.dropna().tolist())))
        .tolist()
    )
    transaction_lists = [basket for basket in transaction_lists if basket]
    encoder = TransactionEncoder()
    encoded = encoder.fit(transaction_lists).transform(transaction_lists)
    basket_matrix = pd.DataFrame(encoded, columns=encoder.columns_)

    selected_rules = pd.DataFrame()
    selected_support = None
    for min_support in (0.10, 0.07, 0.05, 0.03):
        frequent = apriori(
            basket_matrix,
            min_support=min_support,
            use_colnames=True,
            max_len=2,
        )
        if frequent.empty or not any(len(itemset) == 2 for itemset in frequent["itemsets"]):
            continue
        rules = association_rules(frequent, metric="lift", min_threshold=1.0)
        rules = rules[(rules["confidence"] >= 0.5) & (rules["lift"] > 1.0)]
        if not rules.empty:
            selected_rules = rules
            selected_support = min_support
            break

    if selected_rules.empty:
        return {"basis": basis, "data": [], "message": "Belum ditemukan pola yang kuat."}

    pairs = {}
    for _, row in selected_rules.iterrows():
        pair = tuple(sorted(set(row["antecedents"]) | set(row["consequents"])))
        if len(pair) != 2:
            continue
        candidate = {
            "item_a": pair[0],
            "item_b": pair[1],
            "support": float(row["support"]),
            "confidence": float(row["confidence"]),
            "lift": float(row["lift"]),
        }
        if pair not in pairs or candidate["confidence"] > pairs[pair]["confidence"]:
            pairs[pair] = candidate

    results = sorted(pairs.values(), key=lambda item: item["lift"], reverse=True)[:8]
    for result in results:
        result["sentence"] = (
            f"{result['item_a']} dan {result['item_b']} sering terjual bersamaan. "
            "Cocok dijadikan paket."
        )
    return {
        "basis": basis,
        "min_support": selected_support,
        "data": results,
        "message": None if results else "Belum ditemukan pola yang kuat.",
    }


@app.get("/evaluation")
def evaluation(request: Request):
    require_models(request)
    return request.app.state.metrics
