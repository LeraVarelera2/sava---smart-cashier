from pathlib import Path
import re
import difflib

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
REPORT = ROOT / "ml-service" / "reports" / "cleaning_report.md"
OUTPUT = DATA_DIR / "cleaned_historis.csv"


def snake(value):
    value = re.sub(r"[^\w]+", "_", str(value).strip(), flags=re.UNICODE)
    return re.sub(r"_+", "_", value).strip("_").lower()


def clean_text(value):
    if pd.isna(value):
        return None
    return re.sub(r"\s+", " ", str(value).strip())


def parse_money(value):
    if pd.isna(value):
        return None
    text = re.sub(r"[^\d]", "", str(value))
    return int(text) if text else None


def parse_number(value):
    if pd.isna(value):
        return None
    matches = re.findall(r"\d+", str(value).replace(",", "."))
    return int(matches[0]) if matches else None


def parse_date(value):
    if pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp,)):
        return value.normalize()
    try:
        parsed = pd.to_datetime(str(value).strip(), format="%d-%m-%Y", errors="raise")
        return parsed.normalize()
    except Exception:
        parsed = pd.to_datetime(value, dayfirst=True, errors="coerce")
        return parsed.normalize() if pd.notna(parsed) else None


def find_excel():
    files = list(DATA_DIR.glob("*.xlsx")) + list(DATA_DIR.glob("*.xls"))
    if not files:
        raise FileNotFoundError("Dataset Excel tidak ditemukan di data/")
    return max(files, key=lambda path: path.stat().st_mtime)


def main():
    excel = find_excel()
    workbook = pd.ExcelFile(excel)
    print(f"Dataset: {excel.name}")
    print(f"Sheet: {workbook.sheet_names}")

    frames = []
    counts = {}
    dropped = {"invalid_date": 0, "invalid_qty_or_total": 0, "empty": 0}
    filled_dates = 0
    cleaned_spaces = 0
    merged_variants = 0
    duplicate_rows = 0

    for sheet in workbook.sheet_names:
        raw = pd.read_excel(excel, sheet_name=sheet, header=None)
        counts[sheet] = {"initial": len(raw)}
        print(f"\nSheet {sheet}: {raw.shape} | kolom: {raw.shape[1]} | tipe: {raw.dtypes.astype(str).to_dict()}")
        print(raw.head(5).to_string(index=False))

        header_row = None
        for index in range(min(10, len(raw))):
            row_text = " ".join(str(value) for value in raw.iloc[index].tolist()).lower()
            if "tanggal" in row_text and "quantity" in row_text:
                header_row = index
                break
        if header_row is None:
            continue

        frame = pd.read_excel(excel, sheet_name=sheet, header=header_row)
        frame.columns = [snake(column) for column in frame.columns]

        for possible in list(frame.columns):
            if possible.startswith("no"):
                frame.drop(columns=[possible], inplace=True)

        required = ["tanggal", "nama_produk", "variant"]
        if not all(name in frame.columns for name in required):
            continue

        quantity_col = next((c for c in frame.columns if "quantity" in c), None)
        isi_col = next((c for c in frame.columns if "isi" in c), None)
        total_col = next((c for c in frame.columns if "total" in c and "harga" in c), None)
        if not quantity_col or not isi_col or not total_col:
            continue

        for index, row in frame.iterrows():
            if row.isna().all():
                dropped["empty"] += 1
                continue

            no_column = next((c for c in frame.columns if c.startswith("no")), None)
            no_urut = parse_number(row[no_column]) if no_column and pd.notna(row[no_column]) else None

            date_value = parse_date(row["tanggal"])
            if pd.isna(row["tanggal"]) and index > 0:
                previous = parse_date(frame.loc[index - 1, "tanggal"]) if index - 1 in frame.index else None
                valid_other = any(pd.notna(row.get(column)) for column in [quantity_col, isi_col, total_col])
                if previous is not None and valid_other:
                    date_value = previous
                    filled_dates += 1
            if date_value is None:
                dropped["invalid_date"] += 1
                continue

            quantity = parse_number(row[quantity_col])
            isi = parse_number(row[isi_col])
            total = parse_money(row[total_col])
            if quantity is None or quantity <= 0 or total is None or total <= 0:
                dropped["invalid_qty_or_total"] += 1
                continue

            name = clean_text(row["nama_produk"])
            variant = clean_text(row["variant"])
            if not name or not variant:
                dropped["empty"] += 1
                continue

            original_variant = str(row["variant"])
            if re.sub(r"\s+", " ", original_variant).strip() != original_variant:
                cleaned_spaces += 1

            frames.append({
                "_no_urut": no_urut,
                "tanggal": date_value.strftime("%Y-%m-%d"),
                "nama_produk": name,
                "variant": variant,
                "isi_pcs": isi,
                "quantity": quantity,
                "total_harga": total,
                "harga_per_pack": round(total / quantity),
                "sheet": sheet,
            })

    if not frames:
        raise RuntimeError("Tidak ada baris valid ditemukan")

    cleaned = pd.DataFrame(frames)
    variant_counts = cleaned["variant"].value_counts()

    normalized = {}
    for variant in cleaned["variant"].unique():
        key = re.sub(r"\s+", " ", str(variant).strip()).casefold()
        normalized.setdefault(key, variant)
    canonical_by_key = {}
    for key, variants in cleaned.assign(_key=cleaned["variant"].map(lambda v: re.sub(r"\s+", " ", str(v).strip()).casefold())).groupby("_key"):
        canonical = variants["variant"].mode().iloc[0]
        canonical_by_key[key] = canonical
        if len(variants["variant"].unique()) > 1:
            merged_variants += len(variants["variant"].unique()) - 1

    cleaned["variant"] = cleaned["variant"].map(
        lambda value: canonical_by_key[re.sub(r"\s+", " ", str(value).strip()).casefold()]
    )

    # Duplicate exact rows are retained unless No. and all cleaned columns are identical.
    rows_before_duplicate_removal = len(cleaned)
    cleaned = cleaned.drop_duplicates(
        subset=["_no_urut", "tanggal", "nama_produk", "variant", "isi_pcs", "quantity", "total_harga", "harga_per_pack", "sheet"],
        keep="first"
    )
    duplicate_rows = rows_before_duplicate_removal - len(cleaned)

    column_order = ["tanggal", "nama_produk", "variant", "isi_pcs", "quantity", "total_harga", "harga_per_pack", "sheet"]
    cleaned = cleaned[column_order]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(OUTPUT, index=False)

    mode_rows = cleaned.groupby(["variant", "isi_pcs"])["harga_per_pack"].agg(
        lambda values: values.mode().iloc[0] if len(values.mode()) else None
    )
    anomalies = []
    for (variant, isi), mode in mode_rows.items():
        matches = cleaned[(cleaned["variant"] == variant) & (cleaned["isi_pcs"] == isi)]
        for _, row in matches.iterrows():
            if mode is not None and row["harga_per_pack"] != mode:
                anomalies.append((row["tanggal"], row["nama_produk"], variant, isi, row["total_harga"], row["harga_per_pack"], int(mode)))

    suggestions = []
    variants = sorted(cleaned["variant"].unique())
    for variant in variants:
        close = difflib.get_close_matches(variant, [v for v in variants if v != variant], n=3, cutoff=0.82)
        if close:
            suggestions.append((variant, close))

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Laporan Cleaning Data Historis",
        "",
        f"- File sumber: `{excel.name}`",
        f"- Baris awal per sheet: {counts}",
        f"- Baris valid akhir: {len(cleaned)}",
        f"- Baris dibuang - tanggal tidak valid: {dropped['invalid_date']}",
        f"- Baris dibuang - quantity/total tidak valid: {dropped['invalid_qty_or_total']}",
        f"- Baris dibuang - teks/kosong: {dropped['empty']}",
        f"- Baris dibuang - duplikat persis dengan nomor urut sama: {duplicate_rows}",
        f"- Tanggal diisi dari baris sebelumnya: {filled_dates}",
        f"- Perbaikan spasi: {cleaned_spaces}",
        f"- Varian digabung karena beda kapital/spasi: {merged_variants}",
        f"- Rentang tanggal akhir: {cleaned['tanggal'].min()} sampai {cleaned['tanggal'].max()}",
        "",
        "## Daftar varian akhir",
    ]
    lines.extend([f"- {variant}" for variant in variants])
    lines.extend(["", "## Saran varian mirip (belum digabung otomatis)", ""])
    if suggestions:
        lines.extend([f"- `{a}` mirip dengan: {', '.join(f'`{b}`' for b in b_list)}" for a, b_list in suggestions])
    else:
        lines.append("- Tidak ada saran mirip.")
    lines.extend(["", "## Baris menyimpang harga per pack", ""])
    if anomalies:
        lines.extend([
            f"- {date} | {name} | {variant} | isi {isi} | total Rp{total:,} | harga/pack Rp{actual:,} | modus Rp{mode:,}"
            for date, name, variant, isi, total, actual, mode in anomalies[:100]
        ])
    else:
        lines.append("- Tidak ada penyimpangan terdeteksi.")
    lines.extend(["", "## Bukti tahapan", "", "- Gathering: inspeksi seluruh sheet dan header.", "- Assessing: tipe, nilai kosong, duplikasi, dan anomali harga.", "- Cleaning: parsing tanggal/uang/angka, normalisasi teks, dan penyimpanan CSV bersih."])

    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nCleaned rows: {len(cleaned)}")
    print(f"Output: {OUTPUT}")
    print(f"Report: {REPORT}")


if __name__ == "__main__":
    main()
