"""
One-time migration: remove deprecated `embedding` field from all documents in `plots`.

Usage:
  python backend/scripts/remove_embedding_field.py
"""

from pymongo import MongoClient
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import MONGODB_URI, MONGODB_DB, COL_PLOTS


def main() -> None:
    client = MongoClient(MONGODB_URI)
    db = client[MONGODB_DB]
    result = db[COL_PLOTS].update_many(
        {"embedding": {"$exists": True}},
        {"$unset": {"embedding": ""}},
    )
    print(f"matched={result.matched_count} modified={result.modified_count}")


if __name__ == "__main__":
    main()
