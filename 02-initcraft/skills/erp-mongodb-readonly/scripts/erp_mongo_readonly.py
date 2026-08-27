#!/usr/bin/env python3
"""Read-only helper for inspecting the ERP MongoDB database.

The MongoDB URI must come from an environment variable. Do not pass secrets as
CLI arguments and do not write them into skill files.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections.abc import Mapping
from typing import Any

from pymongo import MongoClient


READ_ONLY_HELP = "This script only performs read-only MongoDB operations."


def get_client(uri_env: str) -> MongoClient:
    uri = os.environ.get(uri_env)
    if not uri:
        raise SystemExit(f"Missing {uri_env}. Set the MongoDB URI in an environment variable.")

    if "directConnection=" not in uri:
        sep = "&" if "?" in uri else "?"
        uri = f"{uri}{sep}directConnection=true"

    client = MongoClient(uri, serverSelectionTimeoutMS=8000, connectTimeoutMS=8000, socketTimeoutMS=8000)
    client.admin.command("ping")
    return client


def infer_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "str"
    if isinstance(value, list):
        return "list"
    if isinstance(value, Mapping):
        return "object"
    return type(value).__name__


def flatten(prefix: str, value: Any, out: dict[str, set[str]]) -> None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            out.setdefault(path, set()).add(infer_type(child))
            flatten(path, child, out)
    elif isinstance(value, list):
        out.setdefault(prefix, set()).add("list")
        for item in value[:3]:
            flatten(f"{prefix}[]", item, out)


def normalize_doc(doc: Any) -> Any:
    return json.loads(json.dumps(doc, default=str))


def list_collections(client: MongoClient, database: str) -> list[str]:
    return sorted(client[database].list_collection_names())


def main() -> int:
    parser = argparse.ArgumentParser(description=READ_ONLY_HELP)
    parser.add_argument("command", choices=["databases", "list", "exists", "match", "sample", "count", "schema"])
    parser.add_argument("--uri-env", default="MDB_MCP_CONNECTION_STRING")
    parser.add_argument("--database", default="erp")
    parser.add_argument("--collection")
    parser.add_argument("--pattern")
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()

    client = get_client(args.uri_env)
    try:
        if args.command == "databases":
            print(json.dumps(sorted(client.list_database_names()), indent=2))
            return 0

        if args.command == "list":
            print(json.dumps(list_collections(client, args.database), indent=2))
            return 0

        if args.command == "exists":
            if not args.collection:
                raise SystemExit("--collection is required")
            names = list_collections(client, args.database)
            print(json.dumps({"database": args.database, "collection": args.collection, "exists": args.collection in names}, indent=2))
            return 0

        if args.command == "match":
            if not args.pattern:
                raise SystemExit("--pattern is required")
            rx = re.compile(args.pattern, re.I)
            matches = [name for name in list_collections(client, args.database) if rx.search(name)]
            print(json.dumps(matches, indent=2))
            return 0

        if not args.collection:
            raise SystemExit("--collection is required")

        collection = client[args.database][args.collection]

        if args.command == "count":
            print(json.dumps({"database": args.database, "collection": args.collection, "count": collection.estimated_document_count()}, indent=2))
            return 0

        if args.command == "sample":
            docs = [normalize_doc(doc) for doc in collection.find({}, limit=max(1, min(args.limit, 20)))]
            print(json.dumps(docs, indent=2, ensure_ascii=False))
            return 0

        if args.command == "schema":
            fields: dict[str, set[str]] = {}
            for doc in collection.find({}, limit=max(1, min(args.limit, 100))):
                flatten("", doc, fields)
            schema = {key: sorted(value) for key, value in sorted(fields.items())}
            print(json.dumps(schema, indent=2, ensure_ascii=False))
            return 0

        raise SystemExit("Unsupported command")
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
