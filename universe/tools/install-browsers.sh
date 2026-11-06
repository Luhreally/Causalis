#!/bin/bash
# bash tools/install-browsers.sh <browser...>: the browsers a CI job's gates need, with a limit on each step.
# `playwright install --with-deps` goes to apt first. For Chromium every library is on the image already and apt adds only nine
# font packages, but on 2026-11-06 the mirror gave those at 30 kB/s (ten minutes, in four jobs of 16) or not at all (one job hung
# for 56 minutes), and a try cut off leaves apt holding its lock, so trying again fails at once. So: the browsers alone, each try
# with a limit and started again if it stalls; and apt only for a browser that can't start without it.
got=""
for try in 1 2 3 4; do
  if timeout -k 20 180 npx playwright install "$@"; then
    got=1
    break
  fi
  echo "::warning::browser download, try $try, stalled or failed"
  sleep 5
done
[ -n "$got" ] || exit 1
starts() {
  node --input-type=module -e '
    import * as p from "playwright";
    for (const name of process.argv.slice(1)) {
      const b = await p[name].launch();
      await b.close();
    }
  ' "$@"
}
starts "$@" && exit 0
echo "::warning::a browser needs the system's packages: apt, for as long as it takes"
timeout -k 20 1200 npx playwright install-deps "$@" || exit 1
starts "$@"
