#!/bin/bash
set -e

echo "Restoring database from dump..."

if [ -d /dump/land_plots ]; then
    mongorestore --drop --db land_plots /dump/land_plots
    echo "Restore complete"
else
    echo "No dump found, skipping restore"
fi
