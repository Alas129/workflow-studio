"""Helper route: upload CSV and preview as structured data for matrix."""
from __future__ import annotations

import csv
import io
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post("/csv")
async def upload_csv(file: UploadFile = File(...)) -> dict[str, Any]:
    """Parse uploaded CSV and return list of row dicts plus column names.

    Use the returned `rows` directly as the `data` parameter of a `load_targets`
    (source_type=inline_json) step.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Expected a .csv file")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    columns = reader.fieldnames or []

    return {
        "filename": file.filename,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }
