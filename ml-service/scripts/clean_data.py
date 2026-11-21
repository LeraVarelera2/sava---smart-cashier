from pathlib import Path
import re
import difflib

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
REPORT = ROOT / "ml-service" / "reports" / "cleaning_report.md"
DROP_REPORT = ROOT / "ml-service" / "reports" / "dropped_duplicates.csv"
VARIANT_REVIEW = ROOT / "ml-service" / "reports" / "variant_review.md"
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
    if isinstance(value, (int, float)):
        return int(round(value))

    text = re.sub(r"(?i)\brp\b", "", str(value)).strip().replace(" ", "")
    if not text:
        return None
    if "," in text and "." in text:
        decimal_separator = "," if text.rfind(",") > text.rfind(".") else "."
        thousands_separator = "." if decimal_separator == "," else ","
        text = text.replace(thousands_separator, "")
        text = text.split(decimal_separator, 1)[0]
    elif "," in text:
        integer, decimal = text.rsplit(",", 1)
        text = integer.replace(".", "").replace(",", "") if len(decimal) == 3 else integer.replace(".", "")
    else:
        text = text.replace(".", "").replace(",", "")
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


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


def canonical_mix(variant):
    match = re.fullmatch(r"(Pisbol|Premium)\s+(.+?)\s+\(Mix\)", variant, flags=re.IGNORECASE)
    if not match:
        return variant

    flavors = ["Ubi Ungu", "Coklat", "Keju", "Tape", "Beef"]
    order = {"Coklat": 0, "Keju": 1, "Tape": 2, "Beef": 3, "Ubi Ungu": 4}
    remaining = match.group(2).strip()
    components = []
    while remaining:
        remaining = remaining.lstrip()
        flavor = next(
            (item for item in flavors if remaining.casefold().startswith(item.casefold())
             and (len(remaining) == len(item) or remaining[len(item)].isspace())),
            None,
        )
        if flavor is None:
            return variant
        components.append(flavor)
        remaining = remaining[len(flavor):].strip()

    if len(components) != 2 or len(set(components)) != 2:
        return variant
    components.sort(key=order.get)
    return f"{match.group(1).title()} {' '.join(components)} (Mix)"


def source_value(value):
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    return str(value)


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
    source_stats = {}
    no_checks = {}
    dropped = {"invalid_date": 0, "invalid_qty_or_total": 0, "empty": 0}
    filled_dates = 0
    cleaned_spaces = 0
    merged_variants = 0
    duplicate_rows = 0
    historical_dropped = []

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

        required = ["tanggal", "nama_produk", "variant"]
        if not all(name in frame.columns for name in required):
            continue

        no_column = next((c for c in frame.columns if c.startswith("no")), None)
        quantity_col = next((c for c in frame.columns if "quantity" in c), None)
        isi_col = next((c for c in frame.columns if "isi" in c), None)
        total_col = next((c for c in frame.columns if "total" in c and "harga" in c), None)
        if not quantity_col or not isi_col or not total_col:
            continue

        if no_column:
            no_values = [parse_number(value) for value in frame[no_column]]
            present_no = [value for value in no_values if value is not None]
            no_checks[sheet] = {
                "count": len(no_values),
                "blank": len(no_values) - len(present_no),
                "unique": len(set(present_no)),
                "sequential": present_no == list(range(1, len(present_no) + 1)),
            }
        else:
            no_checks[sheet] = {"count": len(frame), "blank": len(frame), "unique": 0, "sequential": False}

        source_stats[sheet] = {
            "rows": len(frame),
            "total": sum(parse_money(value) or 0 for value in frame[total_col]),
        }
        source_signatures = set()
        for index, row in frame.iterrows():
            if row.isna().all():
                dropped["empty"] += 1
                continue

            no_urut = parse_number(row[no_column]) if no_column and pd.notna(row[no_column]) else None
            signature = repr(tuple(source_value(value) for value in row.tolist()))
            if signature in source_signatures:
                duplicate_rows += 1
                continue
            source_signatures.add(signature)

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
                "_source_signature": signature,
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
    canonical_by_key = {}
    for key, variants in cleaned.assign(_key=cleaned["variant"].map(lambda v: re.sub(r"\s+", " ", str(v).strip()).casefold())).groupby("_key"):
        canonical = variants["variant"].mode().iloc[0]
        canonical_by_key[key] = canonical
        if len(variants["variant"].unique()) > 1:
            merged_variants += len(variants["variant"].unique()) - 1

    cleaned["variant"] = cleaned["variant"].map(
        lambda value: canonical_by_key[re.sub(r"\s+", " ", str(value).strip()).casefold()]
    )

    # Keep every distinct source row; No. is part of the exact source signature.
    before_mix_normalization = cleaned.copy()
    mix_renamed_count = sum(
        canonical_mix(variant) != variant
        for variant in before_mix_normalization["variant"].unique()
    )
    cleaned["variant"] = cleaned["variant"].map(canonical_mix)
    duplicate_key = ["tanggal", "nama_produk", "variant", "isi_pcs", "quantity", "total_harga", "harga_per_pack", "sheet"]
    # Archive rows the previous rule mistakenly dropped because it ignored No.
    prior_rule_duplicates = before_mix_normalization.duplicated(subset=duplicate_key, keep="first")
    for _, row in before_mix_normalization.loc[prior_rule_duplicates].iterrows():
        historical_dropped.append({
            "sheet": row["sheet"],
            "No.": row["_no_urut"],
            "tanggal": row["tanggal"],
            "varian": row["variant"],
            "isi": row["isi_pcs"],
            "quantity": row["quantity"],
            "total": row["total_harga"],
        })

    cleaned = cleaned.drop_duplicates(subset=["_source_signature"], keep="first")
    if historical_dropped:
        pd.DataFrame(historical_dropped, columns=["sheet", "No.", "tanggal", "varian", "isi", "quantity", "total"]).to_csv(
            DROP_REPORT, index=False
        )
    else:
        pd.DataFrame(columns=["sheet", "No.", "tanggal", "varian", "isi", "quantity", "total"]).to_csv(
            DROP_REPORT, index=False
        )

    sheet_stats = []
    for sheet in workbook.sheet_names:
        sheet_data = cleaned[cleaned["sheet"] == sheet]
        source = source_stats.get(sheet, {"rows": 0, "total": 0})
        sheet_stats.append({
            "sheet": sheet,
            "excel_rows": source["rows"],
            "cleaned_rows": len(sheet_data),
            "excel_total": source["total"],
            "cleaned_total": int(sheet_data["total_harga"].sum()),
        })

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
    review_names = {
        "Pisbol Smoked Beef",
        "Pisbol Pisang Coklat (Mix)",
        "Pisbol Ubi Ungu Pisang Keju (Mix)",
        "Mix Keju",
        "Bolen Tape Keju",
        "Premium Mix",
        "Pisbol Ubi Ungu Keju",
    }
    review_rows = []
    for variant in sorted(review_names.intersection(set(cleaned["variant"]))):
        subset = cleaned[cleaned["variant"] == variant]
        review_rows.append(
            f"| {variant} | {len(subset)} | {', '.join(sorted(subset['sheet'].unique()))} |"
        )
    VARIANT_REVIEW.write_text(
        "\n".join([
            "# Review Nama Varian",
            "",
            "Varian berikut sengaja tidak digabung atau dinormalisasi otomatis; mohon tentukan apakah nama-nama ini valid atau perlu koreksi.",
            "",
            "| Varian | Jumlah baris | Sheet |",
            "|---|---:|---|",
            *review_rows,
        ]),
        encoding="utf-8",
    )

    lines = [
        "# Laporan Cleaning Data Historis",
        "",
        f"- File sumber: `{excel.name}`",
        f"- Baris awal per sheet: {counts}",
        f"- Baris valid akhir: {len(cleaned)}",
        "",
        "## Perbandingan baris dan total harga per sheet",
        "",
        "| Sheet | Baris Excel | Baris CSV | Total Excel | Total CSV |",
        "|---|---:|---:|---:|---:|",
        *[
            f"| {item['sheet']} | {item['excel_rows']} | {item['cleaned_rows']} | Rp{item['excel_total']:,} | Rp{item['cleaned_total']:,} |"
            for item in sheet_stats
        ],
        f"| **Total** | **{sum(item['excel_rows'] for item in sheet_stats)}** | **{sum(item['cleaned_rows'] for item in sheet_stats)}** | **Rp{sum(item['excel_total'] for item in sheet_stats):,}** | **Rp{sum(item['cleaned_total'] for item in sheet_stats):,}** |",
        "",
        "## Pemeriksaan nomor urut No.",
        "",
        "| Sheet | Baris bernomor | Kosong | Nomor unik | Berurutan 1..n |",
        "|---|---:|---:|---:|---|",
        *[
            f"| {sheet} | {item['count']} | {item['blank']} | {item['unique']} | {'Ya' if item['sequential'] else 'Tidak'} |"
            for sheet, item in no_checks.items()
        ],
        "",
        f"- Baris dibuang - tanggal tidak valid: {dropped['invalid_date']}",
        f"- Baris dibuang - quantity/total tidak valid: {dropped['invalid_qty_or_total']}",
        f"- Baris dibuang - teks/kosong: {dropped['empty']}",
        f"- Baris dibuang - salinan sumber yang benar-benar identik (termasuk No.): {duplicate_rows}",
        f"- Baris yang aturan deduplikasi lama keliru buang (disimpan di `{DROP_REPORT.relative_to(ROOT)}`): {len(historical_dropped)}; seluruhnya dipertahankan pada CSV baru.",
        f"- Tanggal diisi dari baris sebelumnya: {filled_dates}",
        f"- Perbaikan spasi: {cleaned_spaces}",
        f"- Varian digabung karena beda kapital/spasi: {merged_variants}",
        f"- Nama varian Mix yang urutan rasanya dinormalisasi: {mix_renamed_count}",
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
    print(f"Prior-rule duplicate rows archived: {len(historical_dropped)}")
    print(f"\nCleaned rows: {len(cleaned)}")
    print(f"Output: {OUTPUT}")
    print(f"Report: {REPORT}")


if __name__ == "__main__":
    main()
