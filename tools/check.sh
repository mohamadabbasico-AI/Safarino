#!/bin/sh
# Pre-flight integrity check. A bad slice once deleted 57 functions and the
# broken build was pushed, so this runs before every commit.
set -e
cd "$(dirname "$0")/.."
awk '/^    <script>$/{f=1;next} /^    <\/script>$/{f=0} f' index.html > .check.js
node --check .check.js || { echo "FAIL: syntax error in index.html script"; rm -f .check.js; exit 1; }
node --check sw.js      || { echo "FAIL: syntax error in sw.js"; exit 1; }
node --check worker/src/index.js || { echo "FAIL: syntax error in worker"; exit 1; }

node -e '
const fs = require("fs");
const src = fs.readFileSync(".check.js", "utf8");
const have = new Set([...src.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
const required = ["touch","stamp","tombstone","saveToStorage","loadFromStorage","sanitizeTrip",
 "formatNumber","parseAmount","formatSigned","ltrNum","toPersian","tsToJalali","jalaliToTs",
 "formatJalali","jMonthLength","allocateByWeights","expenseShares","computeLedger","balanceOf",
 "calculateSettlements","baseAmount","photoPut","photoGet","compressImage","icon","paintIcons",
 "avatarSVG","escAvatar","mergeTrips","mergeLists","syncNow","newSyncId","joinFromLink",
 "openTrip","renderAll","init"];
const missing = required.filter(n => !have.has(n));
if (missing.length) { console.error("FAIL: missing functions -> " + missing.join(", ")); process.exit(1); }
if (have.size < 150) { console.error("FAIL: only " + have.size + " functions, expected 150+"); process.exit(1); }
const css = fs.readFileSync("index.html", "utf8").split("<style>")[1].split("</style>")[0];
if (css.split("{").length !== css.split("}").length) { console.error("FAIL: unbalanced CSS braces"); process.exit(1); }
if (/linearGradient id="avg/.test(src)) { console.error("FAIL: colliding avatar gradient ids are back"); process.exit(1); }
console.log("OK: " + have.size + " functions, CSS balanced, no id collisions");
'
rm -f .check.js

node tools/contrast.js || exit 1
