#!/usr/bin/env bash
# Corre todas las pruebas de Genefit contra los emuladores de Firebase (no toca la base real).
# Requisitos: Node 18+ y Java 11+.   Uso:  bash pruebas/correr.sh
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"; RAIZ="$(dirname "$AQUI")"
cd "$AQUI"
[ -d node_modules ] || npm install --no-audit --no-fund
# Copia de la app conectada a los emuladores
SITIO="$(mktemp -d)"
cp -r "$RAIZ"/{index.html,icons,manifest.webmanifest,sw.js,anim3d.js,vendor} "$SITIO"/
python3 - "$SITIO/index.html" <<'PY'
import sys; p = sys.argv[1]; s = open(p, encoding='utf-8').read()
a = "S.auth=firebase.auth();S.db=firebase.firestore();"
assert a in s, 'no encontré la conexión a Firebase en index.html'
s = s.replace(a, a + "S.auth.useEmulator('http://127.0.0.1:9099');S.db.settings({experimentalForceLongPolling:true,experimentalAutoDetectLongPolling:false,merge:true});S.db.useEmulator('127.0.0.1',8080);")
s = s.replace("</head>", "<style>.firebase-emulator-warning{display:none!important}</style></head>")
s = s.replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:9099 http://127.0.0.1:8080")
open(p, 'w', encoding='utf-8').write(s)
PY
python3 -m http.server 8766 --directory "$SITIO" >/dev/null 2>&1 & SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null; rm -rf "$SITIO"' EXIT
cp ../firestore.rules ./firestore.rules
cat > firebase.json <<JSON
{"firestore":{"rules":"firestore.rules"},
 "emulators":{"firestore":{"port":8080,"host":"127.0.0.1"},"auth":{"port":9099,"host":"127.0.0.1"},"ui":{"enabled":false},"hub":{"host":"127.0.0.1"},"logging":{"host":"127.0.0.1"}}}
JSON
npx firebase emulators:exec --only firestore,auth --project genefit-test \
  "node reglas.test.mjs firestore.rules && node app.test.mjs" 2>&1 \
  | grep -vE "MetadataLookup|trace-warnings|^i  |^⚠|^✔|GrpcConnection|^\s*$|for '(create|update|delete|get|list)'|No matching allow|PERMISSION_DENIED"
