#!/bin/bash
# bash tools/install-browsers.sh <browser...>: the browsers a CI job's gates need, for one that stalls. A normal install takes
# 13 to 91 s; on 2026-11-06 four of 16 stalled for ten minutes or more and one never came back, holding a deploy with nothing to
# say so. So each try gets four minutes, and a stalled one is started again.
for try in 1 2 3 4; do
  if timeout -k 20 240 npx playwright install --with-deps "$@"; then
    exit 0
  fi
  echo "::warning::browser install, try $try, stalled or failed"
  sleep 5
done
exit 1
