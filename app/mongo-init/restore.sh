#!/bin/bash
set -e

DUMP_DIR="/dump/land_plots"

if [ -d "$DUMP_DIR" ]; then
    echo "=== Restoring database from dump ==="
    mongorestore --drop --db land_plots "$DUMP_DIR"
    echo "=== Restore complete ==="
else
    echo "=== No dump found at $DUMP_DIR, skipping restore ==="
fi
