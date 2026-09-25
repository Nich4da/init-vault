#!/usr/bin/env python3
"""Send one controlled LIS partial-result UAT using identities read from HIS.

The script never prints HN, VN, the MongoDB URI, or the API key. MongoDB access
is read-only; the only write is the explicitly requested lis.receive HTTP call.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from bson import ObjectId
from pymongo import MongoClient


PROCESS_ID = "6a8da8a6f851000f28e50299"
DEFAULT_LAB_NO = "106909010002"
DEFAULT_URL = "https://apihis.softmax-one.com/api/v1/external/lis.receive"
ACTIVE = {"$nin": [0, 3]}


def load_repo_env() -> None:
    env_path = Path(__file__).resolve().parents[4] / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)


def mongo_uri() -> str:
    raw = os.environ.get("MDB_MCP_CONNECTION_STRING", "")
    if not raw:
        raise SystemExit("ไม่พบ MDB_MCP_CONNECTION_STRING ใน environment หรือ .env")
    if os.environ.get("MDB_MCP_READ_ONLY", "").lower() != "true":
        raise SystemExit("หยุด: MDB_MCP_READ_ONLY ต้องเป็น true")
    parts = urlsplit(raw)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.setdefault("authSource", "his")
    query.setdefault("directConnection", "true")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def text(value: object) -> str:
    return str(value or "").strip()


def parse_json(value: object) -> object:
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return None


def find_cpoe_item(db, source_id: object):
    queries = [{"_id": source_id}]
    try:
        queries.append({"_id": ObjectId(text(source_id))})
    except Exception:
        pass
    for query in queries:
        row = db.zdata_cpoe_order_item.find_one(query)
        if row:
            return row
    return None


def build_context(db, lab_no: str, test_case: str) -> dict:
    work_rows = list(db.zdata_lab_work_item.find({"lab_no": lab_no, "xrstatx": ACTIVE}))
    if len(work_rows) != 1:
        raise SystemExit(f"หยุด: พบ Work Item สำหรับ LAB NO. {lab_no} จำนวน {len(work_rows)} record")
    work = work_rows[0]
    work_status = text(work.get("work_status")).lower()
    allowed_statuses = ({"received", "processing"} if test_case == "partial"
                        else {"resulted"} if test_case in {"duplicate", "final"}
                        else {"completed"})
    if work_status not in allowed_statuses:
        raise SystemExit(
            f"หยุด: Work Item status={work_status or '(ว่าง)'} ไม่เหมาะกับ {test_case} UAT"
        )

    selected = parse_json(work.get("selected_items") or work.get("selected_items_json"))
    if not isinstance(selected, list) or len(selected) != 1 or not isinstance(selected[0], dict):
        raise SystemExit("หยุด: runner นี้รองรับ UAT Work Item ที่มี selected item เดียว")
    item = selected[0]
    # Must mirror the corrected receiver: the code actually sent to Agent wins.
    obs_code = next((text(item.get(key)) for key in
                     ("test_code", "his_code_id", "obs_code", "item_code", "code")
                     if text(item.get(key))), "")
    if not obs_code:
        raise SystemExit("หยุด: selected item ไม่มีรหัสสำหรับจับคู่ผล")

    identity_ids = {text(work.get("_id")), text(work.get("dataid")),
                    text(work.get("source_specimen_record_id"))} - {""}
    outbound_rows = list(db.zdata_lab_outband_order.find({
        "$or": [{"lab_no": lab_no}, {"labno": lab_no}], "xrstatx": ACTIVE
    }))
    matching_outbound = [row for row in outbound_rows if text(row.get("order_no")) in identity_ids]
    if len(matching_outbound) != 1:
        raise SystemExit(f"หยุด: Outbound ที่ตรง Work Item มี {len(matching_outbound)} record")
    outbound_payload = parse_json(matching_outbound[0].get("request_payload_json"))
    outbound_items = outbound_payload.get("items", []) if isinstance(outbound_payload, dict) else []
    outbound_code = text(outbound_items[0].get("test_code")) if len(outbound_items) == 1 else ""
    if not outbound_code or outbound_code != obs_code:
        raise SystemExit("หยุด: selected test_code ไม่ตรงกับ Outbound test_code")

    receipt_count = db.zdata_lab_result_inbound.count_documents(
        {"filler_order_no": lab_no, "xrstatx": ACTIVE})
    report_count = db.zdata_lab_report_manual_entry.count_documents(
        {"filler_order_no": lab_no, "xrstatx": ACTIVE})
    result_count = db.zdata_lab_result_item.count_documents(
        {"filler_order_no": lab_no, "xrstatx": ACTIVE})
    result_uid = (f"UAT-HL7-{lab_no}-FINAL-002" if test_case == "corrected"
                  else f"UAT-HL7-{lab_no}-PARTIAL-001")
    existing_receipt = db.zdata_lab_result_inbound.find_one(
        {"result_uid": result_uid, "xrstatx": ACTIVE}
    )
    if test_case == "partial":
        if receipt_count or report_count or result_count:
            raise SystemExit(
                f"หยุด: LAB NO. นี้ไม่สะอาด (Receipt={receipt_count}, Report={report_count}, Result={result_count})"
            )
    elif test_case in {"duplicate", "final"} and (
            receipt_count != 1 or report_count != 1 or result_count != 1 or not existing_receipt):
        raise SystemExit(
            f"หยุด: {test_case} UAT ต้องเริ่มจาก partial ที่มี Receipt/Report/Result อย่างละ 1 record"
        )
    elif test_case == "corrected" and (
            receipt_count != 2 or report_count != 2 or result_count != 1 or not existing_receipt):
        raise SystemExit(
            "หยุด: corrected UAT ต้องเริ่มจาก partial+final ที่มี Receipt=2, Report=2, Result=1"
        )
    elif text(existing_receipt.get("receipt_status")).lower() != "processed":
        raise SystemExit(f"หยุด: Receipt ก่อนหน้าไม่ใช่ processed; ห้ามยิง {test_case}")

    hn = text(work.get("patient_hn"))
    visit_id = text(work.get("visit_id") or work.get("visit_vn"))
    if not hn or not visit_id:
        raise SystemExit("หยุด: Work Item ไม่มี HN หรือ visit_id")
    source_id = work.get("source_specimen_record_id") or work.get("dataid") or work.get("_id")
    cpoe = find_cpoe_item(db, source_id)
    if not cpoe:
        raise SystemExit("หยุด: ไม่พบ CPOE Item ต้นทาง")
    expected_cpoe_status = "completed" if test_case == "corrected" else "sent"
    if test_case != "partial" and text(cpoe.get("current_status")).lower() != expected_cpoe_status:
        raise SystemExit(
            f"หยุด: CPOE Item status ต้องเป็น {expected_cpoe_status} ก่อน {test_case} UAT"
        )

    existing_report = None
    existing_item = None
    if test_case in {"duplicate", "final", "corrected"}:
        existing_report = db.zdata_lab_report_manual_entry.find_one(
            {"result_uid": result_uid, "xrstatx": ACTIVE}
        )
        existing_item = db.zdata_lab_result_item.find_one(
            {"filler_order_no": lab_no, "obs_code": obs_code, "xrstatx": ACTIVE}
        )
        expected_stage = "final" if test_case == "corrected" else "partial"
        expected_sequence = "2" if test_case == "corrected" else "1"
        if (not existing_report or text(existing_report.get("stage")).lower() != expected_stage or
                text(existing_report.get("report_seq")) != expected_sequence):
            raise SystemExit(f"หยุด: ไม่พบ {expected_stage} Report ลำดับ {expected_sequence} ที่ถูกต้อง")
        if (not existing_item or text(existing_item.get("result_version")) != expected_sequence or
                text(existing_item.get("result_report_id")) != text(existing_report.get("_id"))):
            raise SystemExit(
                f"หยุด: Result Item ปัจจุบันไม่ตรงกับ {expected_stage} version {expected_sequence}"
            )

    if test_case == "final":
        final_uid = f"UAT-HL7-{lab_no}-FINAL-002"
        if db.zdata_lab_result_inbound.count_documents({"result_uid": final_uid, "xrstatx": ACTIVE}):
            raise SystemExit("หยุด: พบ final result_uid นี้แล้ว; ห้ามยิงซ้ำด้วยเคส final")
    if test_case == "corrected":
        corrected_uid = f"UAT-HL7-{lab_no}-CORRECTED-003"
        if db.zdata_lab_result_inbound.count_documents({"result_uid": corrected_uid, "xrstatx": ACTIVE}):
            raise SystemExit("หยุด: พบ corrected result_uid นี้แล้ว; ห้ามยิงซ้ำด้วยเคส corrected")

    live_process = db.module_api.find_one({"_id": ObjectId(PROCESS_ID)}, {"api_process": 1}) or {}
    body = text(live_process.get("api_process"))
    test_index = body.find("item && item.test_code")
    item_index = body.find("item && item.item_code")
    if test_index < 0 or item_index < 0 or test_index > item_index:
        raise SystemExit("หยุด: Process live ยังไม่ได้ replace รุ่นที่ให้ outbound test_code มาก่อน item_code")

    return {
        "work": work,
        "work_status": work_status,
        "cpoe_status": text(cpoe.get("current_status")),
        "hn": hn,
        "visit_id": visit_id,
        "obs_code": obs_code,
        "obs_name": text(item.get("name") or item.get("test_name") or item.get("item_name")) or obs_code,
        "existing_receipt": existing_receipt,
        "existing_report": existing_report,
        "existing_item": existing_item,
    }


def thai_now() -> str:
    return datetime.now(timezone(timedelta(hours=7))).isoformat(timespec="seconds")


def post_json(url: str, body: dict) -> tuple[int, dict]:
    """POST with Node fetch, matching the transport used by the proven smoke test.

    The API key stays in the inherited environment rather than argv/stdin/output.
    """
    node_script = r"""
const fs = require('fs')
const input = JSON.parse(fs.readFileSync(0, 'utf8'))
;(async () => {
  try {
    const response = await fetch(input.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.LIS_RECEIVE_APIKEY,
      },
      body: JSON.stringify(input.body),
    })
    const raw = await response.text()
    process.stdout.write(JSON.stringify({ status: response.status, raw }))
  } catch (error) {
    process.stdout.write(JSON.stringify({ status: 0, network_error: String(error && error.message || error) }))
  }
})()
"""
    try:
        completed = subprocess.run(
            ["node", "-e", node_script],
            input=json.dumps({"url": url, "body": body}, ensure_ascii=False),
            text=True,
            capture_output=True,
            timeout=25,
            check=False,
        )
    except FileNotFoundError as error:
        raise SystemExit("ไม่พบ Node.js ซึ่งจำเป็นสำหรับ transport ของ UAT runner") from error
    except subprocess.TimeoutExpired as error:
        raise SystemExit("NETWORK: request timeout หลัง 25 วินาที") from error
    if completed.returncode != 0:
        raise SystemExit(f"NETWORK: Node fetch จบด้วย exit code {completed.returncode}")
    try:
        transport = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise SystemExit("NETWORK: อ่านผลจาก Node fetch ไม่ได้") from error
    if transport.get("network_error"):
        raise SystemExit(f"NETWORK: {transport['network_error']}")
    raw = transport.get("raw", "")
    try:
        response = json.loads(raw)
    except json.JSONDecodeError:
        response = {"gateway_response": "non-JSON response (content hidden)"}
    return int(transport.get("status", 0)), response


def result_counts(db, lab_no: str, result_uid: str) -> dict:
    return {
        "receipt": db.zdata_lab_result_inbound.count_documents(
            {"result_uid": result_uid, "xrstatx": ACTIVE}),
        "report": db.zdata_lab_report_manual_entry.count_documents(
            {"result_uid": result_uid, "xrstatx": ACTIVE}),
        "result_item": db.zdata_lab_result_item.count_documents(
            {"filler_order_no": lab_no, "xrstatx": ACTIVE}),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Controlled lis.receive partial UAT from a clean HIS Work Item")
    parser.add_argument("--case", choices=("partial", "duplicate", "final", "corrected"), default="partial")
    parser.add_argument("--lab-no", default=DEFAULT_LAB_NO)
    parser.add_argument("--value")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--send", action="store_true")
    args = parser.parse_args()

    load_repo_env()
    client = MongoClient(mongo_uri(), serverSelectionTimeoutMS=8000,
                         connectTimeoutMS=8000, socketTimeoutMS=8000)
    try:
        client.admin.command("ping")
        db = client.his
        context = build_context(db, args.lab_no, args.case)
        uid_suffix = {
            "partial": "PARTIAL-001",
            "duplicate": "PARTIAL-001",
            "final": "FINAL-002",
            "corrected": "CORRECTED-003",
        }[args.case]
        result_uid = f"UAT-HL7-{args.lab_no}-{uid_suffix}"
        if args.case == "duplicate":
            payload = parse_json(context["existing_receipt"].get("raw_payload_json"))
            if not isinstance(payload, dict):
                raise SystemExit("หยุด: อ่าน raw payload จาก Receipt เดิมไม่ได้")
            duplicate_items = payload.get("items", [])
            if (text(payload.get("order_no")) != text(context["work"].get("_id")) or
                    text(payload.get("filler_order_no")) != args.lab_no or
                    text(payload.get("result_uid")) != result_uid or
                    len(duplicate_items) != 1 or
                    text(duplicate_items[0].get("obs_code")) != context["obs_code"]):
                raise SystemExit("หยุด: payload ใน Receipt เดิมไม่ตรงกับ UAT target")
        elif args.case == "partial":
            payload = {
                "order_no": text(context["work"].get("_id")),
                "filler_order_no": args.lab_no,
                "hn": context["hn"],
                "visit_id": context["visit_id"],
                "result_uid": result_uid,
                "report_seq": "1",
                "stage": "partial",
                "overall_status": "in_progress",
                "reported_at": thai_now(),
                "reported_by": {"source_id": "LOCAL-UAT", "source_name": "Local UAT Runner"},
                "items": [{
                    "obs_code": context["obs_code"],
                    "obs_name": context["obs_name"],
                    "value": args.value or "UAT-PARTIAL",
                    "obx_status": "P",
                    "change_kind": "new",
                    "receipt_seq": "1",
                    "result_version": "1",
                    "is_critical": False,
                }],
            }
        elif args.case == "final":
            prior_item = context["existing_item"]
            result_time = thai_now()
            payload = {
                "order_no": text(context["work"].get("_id")),
                "filler_order_no": args.lab_no,
                "hn": context["hn"],
                "visit_id": context["visit_id"],
                "result_uid": result_uid,
                "report_seq": "2",
                "stage": "final",
                "overall_status": "resulted",
                "reported_at": result_time,
                "reported_by": {"source_id": "LOCAL-UAT", "source_name": "Local UAT Runner"},
                "verified_at": result_time,
                "verified_by": {"source_id": "LOCAL-UAT-VERIFY", "source_name": "Local UAT Verifier"},
                "items": [{
                    "obs_code": context["obs_code"],
                    "obs_name": context["obs_name"],
                    "value": args.value or "UAT-FINAL",
                    "obx_status": "F",
                    "change_kind": "updated",
                    "previous_value": text(prior_item.get("result_value")),
                    "receipt_seq": "2",
                    "result_version": "2",
                    "is_critical": False,
                }],
            }
        else:
            prior_item = context["existing_item"]
            payload = {
                "order_no": text(context["work"].get("_id")),
                "filler_order_no": args.lab_no,
                "hn": context["hn"],
                "visit_id": context["visit_id"],
                "result_uid": result_uid,
                "report_seq": "3",
                "stage": "corrected",
                "overall_status": "corrected",
                "reported_at": thai_now(),
                "reported_by": {"source_id": "LOCAL-UAT", "source_name": "Local UAT Runner"},
                "items": [{
                    "obs_code": context["obs_code"],
                    "obs_name": context["obs_name"],
                    "value": args.value or "UAT-CORRECTED",
                    "obx_status": "C",
                    "change_kind": "corrected",
                    "previous_value": text(prior_item.get("result_value")),
                    "receipt_seq": "3",
                    "result_version": "3",
                    "is_critical": False,
                }],
            }
        expected_code = "DUPLICATE_RESULT_UID" if args.case == "duplicate" else "PROCESSED"
        print(json.dumps({
            "mode": "SEND" if args.send else "DRY-RUN",
            "case": args.case,
            "expect": expected_code,
            "lab_no": args.lab_no,
            "work_item_id": payload["order_no"],
            "work_status": context["work_status"],
            "cpoe_status": context["cpoe_status"],
            "obs_code": context["obs_code"],
            "obs_name": context["obs_name"],
            "value": text(payload["items"][0].get("value")),
            "result_uid": result_uid,
            "identity": "HN/VN loaded but hidden",
        }, ensure_ascii=False, indent=2))
        if not args.send:
            print("DRY-RUN: ไม่มี network request และไม่มี HIS write")
            return 0

        api_key = os.environ.get("LIS_RECEIVE_APIKEY", "")
        if not api_key:
            raise SystemExit("ไม่พบ LIS_RECEIVE_APIKEY ใน Terminal environment")
        http_status, response = post_json(args.url, {"params": payload})
        inner = response.get("data", {}) if isinstance(response, dict) else {}
        print(json.dumps({
            "http_status": http_status,
            "outer_status": response.get("status") if isinstance(response, dict) else None,
            "outer_message": response.get("message") if isinstance(response, dict) else None,
            "outer_error": response.get("error") if isinstance(response, dict) else None,
            "trace_id": response.get("trace_id") if isinstance(response, dict) else None,
            "gateway_response": response.get("gateway_response") if isinstance(response, dict) else None,
            "process_code": inner.get("code"),
            "success": inner.get("success"),
            "created": inner.get("created"),
            "duplicate": inner.get("duplicate"),
            "message": inner.get("message"),
            "data": inner.get("data"),
        }, ensure_ascii=False, indent=2, default=str))
        duplicate_ok = (args.case != "duplicate" or
                        (inner.get("created") is False and inner.get("duplicate") is True))
        if http_status != 200 or inner.get("code") != expected_code or not duplicate_ok:
            print(json.dumps({
                "verification": "read-only after failed POST",
                **result_counts(db, args.lab_no, result_uid),
            }, ensure_ascii=False, indent=2))
            return 2

        if args.case == "duplicate":
            counts = result_counts(db, args.lab_no, result_uid)
            existing = context["existing_receipt"]
            current = db.zdata_lab_result_inbound.find_one(
                {"result_uid": result_uid, "xrstatx": ACTIVE}
            ) or {}
            unchanged = (
                counts == {"receipt": 1, "report": 1, "result_item": 1} and
                text(current.get("_id")) == text(existing.get("_id")) and
                text(current.get("result_report_id")) == text(existing.get("result_report_id"))
            )
            print(json.dumps({
                "verification": "read-only after duplicate POST",
                **counts,
                "same_receipt_id": text(current.get("_id")) == text(existing.get("_id")),
                "same_report_id": text(current.get("result_report_id")) == text(existing.get("result_report_id")),
                "no_duplicate_records": unchanged,
            }, ensure_ascii=False, indent=2))
            return 0 if unchanged else 2

        if args.case in {"final", "corrected"}:
            receipt = db.zdata_lab_result_inbound.find_one(
                {"result_uid": result_uid, "xrstatx": ACTIVE}) or {}
            report = db.zdata_lab_report_manual_entry.find_one(
                {"result_uid": result_uid, "xrstatx": ACTIVE}) or {}
            item = db.zdata_lab_result_item.find_one({
                "filler_order_no": args.lab_no,
                "obs_code": context["obs_code"],
                "xrstatx": ACTIVE,
            }) or {}
            work = db.zdata_lab_work_item.find_one(
                {"lab_no": args.lab_no, "xrstatx": ACTIVE}) or {}
            cpoe = find_cpoe_item(
                db, work.get("source_specimen_record_id") or work.get("dataid") or work.get("_id")
            ) or {}
            expected_sequence = "3" if args.case == "corrected" else "2"
            expected_report_status = "corrected" if args.case == "corrected" else "completed"
            expected_item_status = "corrected" if args.case == "corrected" else "final"
            expected_total = 3 if args.case == "corrected" else 2
            total_receipts = db.zdata_lab_result_inbound.count_documents(
                {"filler_order_no": args.lab_no, "xrstatx": ACTIVE})
            total_reports = db.zdata_lab_report_manual_entry.count_documents(
                {"filler_order_no": args.lab_no, "xrstatx": ACTIVE})
            total_items = db.zdata_lab_result_item.count_documents(
                {"filler_order_no": args.lab_no, "xrstatx": ACTIVE})
            resulted_at_ok = (bool(text(work.get("resulted_at"))) if args.case == "final" else
                               text(work.get("resulted_at")) == text(context["work"].get("resulted_at")))
            passed = all([
                text(receipt.get("receipt_status")) == "processed",
                text(report.get("internal_overall_status")) == expected_report_status,
                text(report.get("report_seq")) == expected_sequence,
                text(item.get("_id")) == text(context["existing_item"].get("_id")),
                text(item.get("result_value")) == text(payload["items"][0]["value"]),
                text(item.get("result_version")) == expected_sequence,
                text(item.get("result_status")) == expected_item_status,
                text(work.get("work_status")) == "completed",
                resulted_at_ok,
                text(cpoe.get("current_status")) == "completed",
                total_receipts == expected_total,
                total_reports == expected_total,
                total_items == 1,
            ])
            print(json.dumps({
                "verification": f"read-only after {args.case} POST",
                "receipt_id": text(receipt.get("_id")),
                "receipt_status": text(receipt.get("receipt_status")),
                "report_id": text(report.get("_id")),
                "report_status": text(report.get("internal_overall_status")),
                "report_seq": text(report.get("report_seq")),
                "same_result_item_id": text(item.get("_id")) == text(context["existing_item"].get("_id")),
                "result_value": text(item.get("result_value")),
                "result_version": text(item.get("result_version")),
                "result_status": text(item.get("result_status")),
                "work_status": text(work.get("work_status")),
                "resulted_at_set": bool(text(work.get("resulted_at"))),
                "resulted_at_unchanged": (resulted_at_ok if args.case == "corrected" else None),
                "cpoe_status": text(cpoe.get("current_status")),
                "receipt_count": total_receipts,
                "report_count": total_reports,
                "result_item_count": total_items,
                f"{args.case}_checks_passed": passed,
            }, ensure_ascii=False, indent=2))
            return 0 if passed else 2

        receipt = db.zdata_lab_result_inbound.find_one(
            {"result_uid": result_uid, "xrstatx": ACTIVE}) or {}
        report = db.zdata_lab_report_manual_entry.find_one(
            {"result_uid": result_uid, "xrstatx": ACTIVE}) or {}
        item = db.zdata_lab_result_item.find_one({
            "filler_order_no": args.lab_no,
            "obs_code": context["obs_code"],
            "xrstatx": ACTIVE,
        }) or {}
        work = db.zdata_lab_work_item.find_one(
            {"lab_no": args.lab_no, "xrstatx": ACTIVE}) or {}
        print(json.dumps({
            "verification": "read-only after POST",
            "receipt_id": text(receipt.get("_id")),
            "receipt_status": text(receipt.get("receipt_status")),
            "report_id": text(report.get("_id")),
            "report_status": text(report.get("internal_overall_status")),
            "result_item_id": text(item.get("_id")),
            "result_value": text(item.get("result_value")),
            "work_status": text(work.get("work_status")),
        }, ensure_ascii=False, indent=2))
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
