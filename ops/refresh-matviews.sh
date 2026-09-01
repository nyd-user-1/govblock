#!/usr/bin/env sh
# Hourly on the worker box (crontab: 7 * * * *). pg_cron on Neon only runs
# while the compute is awake; this keeps the views fresh regardless.
#   7 * * * *  POLICY_DATABASE_URL=... /path/to/govblock/ops/refresh-matviews.sh
set -eu
: "${POLICY_DATABASE_URL:?set POLICY_DATABASE_URL}"
psql "$POLICY_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "select public.refresh_policy_matviews()"
