#!/usr/bin/env bash
# SessionStart hook: fires /standup once per day.
#
# Output goes into the session as additional context. When this prints
# the "RUN /standup" line, Claude picks it up and runs the standup
# before doing anything else in the session.
#
# If /standup has already run today, prints nothing.

set -euo pipefail

STATE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATE_FILE="$STATE_DIR/last-standup"
TODAY="$(date +%Y-%m-%d)"

# Decide whether to fire the standup.
FIRE=0
if [[ ! -f "$STATE_FILE" ]]; then
  FIRE=1
elif [[ "$(cat "$STATE_FILE" 2>/dev/null)" != "$TODAY" ]]; then
  FIRE=1
fi

if [[ $FIRE -eq 1 ]]; then
  # Record that we've fired today so we don't fire again this session.
  echo "$TODAY" > "$STATE_FILE"

  cat <<EOF
It's $TODAY. The morning standup has not run yet today.

Before anything else this session, run the \`/standup\` slash command
to give the user a proactive brief on today's work, overdue items, and
calendar shape. After the standup is produced, continue with whatever
the user asked (if anything).
EOF
fi
