#!/bin/bash
# bash tools/install-browsers.sh <browser...>: the browsers a CI job's gates need, with a limit on each step.
# `playwright install --with-deps` goes to apt first. For Chromium every library is on the image already and apt adds only nine
# font packages, but on 2026-11-06 the mirror gave those at 30 kB/s (ten minutes, in four jobs of 16) or not at all (one job hung
# for 56 minutes), and a try cut off leaves apt holding its lock, so trying again fails at once. So: the browsers alone, each try
# with a limit and started again if it stalls; and apt only for a browser that can't start without it.
# WebKit does need apt, and the mirror is a lottery by the job: of four jobs on one commit three had it all in under 65 s and the
# fourth hung until 20 minutes ran out. So apt too gets short tries: what one fetched is kept for the next, and what it leaves
# running is stopped, so the next finds the lock free.
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
echo "::warning::a browser needs the system's packages: apt, in short tries"
printf 'DPkg::Lock::Timeout "60";\nAcquire::Retries "2";\nAcquire::http::Timeout "20";\n' |
  sudo tee /etc/apt/apt.conf.d/90-short-tries >/dev/null
for try in 1 2 3 4 5 6; do
  if timeout -k 20 180 npx playwright install-deps "$@"; then
    starts "$@" && exit 0
  fi
  echo "::warning::system packages, try $try, stalled or failed"
  sudo pkill -x apt-get || true
  sleep 3
  sudo pkill -9 -x apt-get || true
  sudo timeout -k 10 120 dpkg --configure -a || true
done
exit 1
