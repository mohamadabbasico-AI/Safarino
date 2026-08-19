#!/bin/sh
# Headless test suite. Runs the app's own logic in Node against a DOM stub,
# so accounting can be checked without a browser in the loop.
#
#   sh tools/test.sh
set -e
cd "$(dirname "$0")/.."

awk '/^    <script>$/{f=1;next} /^    <\/script>$/{f=0} f' index.html > .app.js

fail=0
for suite in scenarios realtrip hostile invariants; do
  printf '%-12s ' "$suite"
  cat tools/test-env.js .app.js tools/test-helpers.js "tools/test-$suite.js" > .bundle.js
  echo 'report();' >> .bundle.js
  result=$(node .bundle.js 2>&1 | tail -3 | tr '\n' ' ')
  echo "$result"
  case "$result" in
    *"0 failures"*) ;;
    *) fail=1 ;;
  esac
done

rm -f .app.js .bundle.js
if [ "$fail" = "1" ]; then
  echo ""
  echo "FAIL: one or more suites reported failures"
  exit 1
fi
echo ""
echo "OK: all suites green"
