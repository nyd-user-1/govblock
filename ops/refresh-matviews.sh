#!/usr/bin/env sh
# By hand. The scheduled run is the worker box's nightly manifest
# (livingston/ops/box/jobs.d/lv-refresh-matviews.json); this is the same
# refresh from a laptop with psql, e.g. right after a bulk import.
set -eu
: "${POLICY_DATABASE_URL:?set POLICY_DATABASE_URL}"
psql "$POLICY_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "select public.refresh_policy_matviews()"
