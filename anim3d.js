/* Genefit · Animaciones 3D de ejercicios.
   Un muñeco articulado (three.js, licencia MIT) hace cada ejercicio en el teléfono, sin videos.
   Cada ejercicio se asigna a un patrón de movimiento (sentadilla, remo, curl…) con su equipo,
   y los músculos que trabaja se pintan igual que en el mapa: rojo el principal, naranja los secundarios. */
import * as THREE from './vendor/three.module.min.js';

const R = Math.PI / 180;
const M = { pelvis: 0.95, abd: 0.24, pecho: 0.27, hx: 0.19, brazo: 0.29, ante: 0.27, cx: 0.095, muslo: 0.44, pierna: 0.43 };

/* ---------- Qué movimiento hace cada ejercicio ---------- */
const GRUPO = { 'Pecho': 'banca', 'Espalda': 'remo', 'Hombro': 'militar', 'Bíceps': 'curl', 'Tríceps': 'triceps', 'Antebrazo': 'muneca',
  'Abdomen': 'abdominal', 'Cuádriceps': 'sentadilla', 'Femoral': 'curlfem', 'Glúteo': 'puente', 'Aductores': 'aductor', 'Pantorrilla': 'pantorrilla',
  'Lumbar': 'muerto', 'Trapecio': 'encogimiento', 'Cuello': 'cuello', 'Cardio': 'cardio', 'Estiramientos': 'estira' };
const REGLAS = [
  [/stretch|smr|yoga|_pose|circles|rotation_?s?$|around_the_world|chair_leg|ankle_on/, 'estira'],
  [/plank|bridge_?-?_?hold|hollow/, 'plancha'],
  [/push-?_?up|pushup/, 'flexion'],
  [/pull-?_?up|chin-?_?up|muscle_up/, 'dominada'],
  [/pulldown|pull_down|lat_pull/, 'jalon'],
  [/(^|_)dips?(_|$)|dip_machine/, 'fondos'],
  [/deadlift|good_morning|romanian|stiff|rack_pull|pull_through|hyperextension|back_extension/, 'muerto'],
  [/swing/, 'swing'],
  [/lunge|split_squat|step-?_?up|scissor/, 'zancada'],
  [/leg_press|sled/, 'prensa'],
  [/squat|wall_sit|sissy/, 'sentadilla'],
  [/calf|calves|heel_raise|toe_raise/, 'pantorrilla'],
  [/leg_extension/, 'extpierna'],
  [/leg_curl|hamstring_curl|glute_ham/, 'curlfem'],
  [/hip_thrust|glute_bridge|bridge|butt_lift|hip_lift/, 'puente'],
  [/crunch|sit-?_?up|situp|jackknife|v-?_?up|toe_touch|ab_roller|russian_twist|heel_touch/, 'abdominal'],
  [/leg_raise|knee_raise|leg_lift|flutter|knee_tuck|hanging_pike/, 'elevpiernas'],
  [/shrug/, 'encogimiento'],
  [/adduct|abduct|hip_adduction|hip_abduction/, 'aductor'],
  [/lateral_raise|side_lateral|deltoid_raise|lateral_?$|_lateral_/, 'lateral'],
  [/front_raise|front_plate|front_dumbbell_raise|front_cable/, 'frontal'],
  [/reverse_fl|rear_delt|back_fly|face_pull|pull_apart/, 'pajaro'],
  [/crossover|cable_fly|cable_chest_fly|standing_cable_fl/, 'cruce'],
  [/fly|flye|pec_deck|butterfly/, 'apertura'],
  [/bench_press|chest_press|floor_press|incline.*press|decline.*press|board_press|pin_press|svend/, 'banca'],
  [/shoulder_press|military|overhead_press|arnold|push_press|jerk|seated_press|standing_press|kettlebell_press|landmine/, 'militar'],
  [/row/, 'remo'],
  [/pushdown|push_down|tricep|skull|kickback|french|extension|lying_close/, 'triceps'],
  [/wrist/, 'muneca'],
  [/curl/, 'curl'],
  [/bike|bicycl|cycling|recumbent/, 'bici'],
  [/run|sprint|treadmill|trail|walk|skip|high_knee|elliptical|stair|climber|step_mill/, 'correr'],
  [/jump|jack|burpee|bound|hop|rope|rowing/, 'cardio'],
  [/clean|snatch/, 'muerto'],
  [/neck/, 'cuello'],
];
export function patron(e) {
  const id = String(e.id || '').toLowerCase();
  for (const [re, p] of REGLAS) if (re.test(id)) {
    if (p === 'triceps' && e.g !== 'Tríceps') continue; // "extension" también aparece en piernas y espalda
    return p;
  }
  if (/press/.test(id)) return e.g === 'Pecho' ? 'banca' : 'militar';
  return GRUPO[e.g] || 'estira';
}

/* ---------- Poses (grados). hombro: f flexión, a abducción, r giro · codo/rodilla: flexión ---------- */
const H = (f = 0, a = 0, r = 0) => ({ f, a, r });
const P = {
  sentadilla: { base: 'pie', anclar: 'pies', A: { hombro: H(0, 12), codo: 12 }, B: { bisagra: 40, cadera: 55, rodilla: 110, hombro: H(0, 12), codo: 12 } },
  muerto: { base: 'pie', anclar: 'pies', agarre: 'abajo', A: { bisagra: 72, rodilla: 28, hombro: H(72, 6) }, B: { hombro: H(0, 6) } },
  swing: { base: 'pie', anclar: 'pies', prop: 'kb', A: { bisagra: 60, rodilla: 25, hombro: H(40, 4) }, B: { hombro: H(95, 4) } },
  zancada: { base: 'pie', anclar: 'pies', A: { caderaI: 22, caderaD: -18, hombro: H(0, 10), codo: 8 }, B: { caderaI: 85, rodillaI: 92, caderaD: -12, rodillaD: 95, hombro: H(0, 10), codo: 8 } },
  prensa: { base: 'sentado', rx: -45, banco: 'respaldo', prop: 'plataforma', A: { cadera: 100, rodilla: 105, hombro: H(10, 20), codo: 40 }, B: { cadera: 45, rodilla: 8, hombro: H(10, 20), codo: 40 } },
  pantorrilla: { base: 'pie', anclar: 'puntas', A: { hombro: H(0, 10) }, B: { tobillo: 30, hombro: H(0, 10) } },
  extpierna: { base: 'sentado', banco: 'asiento', prop: 'rodillo', A: { cadera: 90, rodilla: 90, hombro: H(-15, 25), codo: 10 }, B: { cadera: 90, rodilla: 5, hombro: H(-15, 25), codo: 10 } },
  curlfem: { base: 'prono', banco: 'largo', A: { rodilla: 5, hombro: H(160, 15), codo: 60 }, B: { rodilla: 115, hombro: H(160, 15), codo: 60 } },
  puente: { base: 'supino', anclar: 'pies', A: { cadera: 80, rodilla: 100, hombro: H(10, 25) }, B: { rx: -24, cadera: 15, rodilla: 92, hombro: H(30, 25) } },
  abdominal: { base: 'supino', anclar: 'espalda', A: { cadera: 60, rodilla: 100, hombro: H(150, 60), codo: 140 }, B: { tronco: 38, cadera: 60, rodilla: 100, hombro: H(150, 60), codo: 140 } },
  elevpiernas: { base: 'supino', anclar: 'espalda', A: { cadera: 5, hombro: H(0, 30) }, B: { cadera: 88, hombro: H(0, 30) } },
  plancha: { base: 'prono', anclar: 'manos', A: { rx: -10, hombro: H(90, 0), codo: 90 }, B: { rx: -12, hombro: H(90, 0), codo: 90 } },
  flexion: { base: 'prono', anclar: 'manos', A: { rx: -20, hombro: H(78, 12), codo: 0 }, B: { rx: -5, hombro: H(30, 50), codo: 95 } },
  dominada: { base: 'colgado', anclar: 'manos', prop: 'barrafija', A: { hombro: H(0, 165, 90), codo: 8, rodilla: 35, cadera: 10 }, B: { hombro: H(0, 70, 90), codo: 125, rodilla: 35, cadera: 10 } },
  jalon: { base: 'sentado', banco: 'asiento', cable: 'alto', A: { cadera: 90, rodilla: 90, hombro: H(0, 160, 90), codo: 10 }, B: { cadera: 90, rodilla: 90, tronco: -12, hombro: H(0, 70, 90), codo: 125 } },
  fondos: { base: 'pie', anclar: 'manos', prop: 'paralelas', A: { hombro: H(-5, 8), codo: 0, rodilla: 70, cadera: 15 }, B: { hombro: H(-55, 15), codo: 95, rodilla: 70, cadera: 15, tronco: 12 } },
  banca: { base: 'supino', banco: 'largo', A: { hombro: H(88, 8), codo: 0, cadera: 12, rodilla: 88 }, B: { hombro: H(12, 70), codo: 92, cadera: 12, rodilla: 88 } },
  apertura: { base: 'supino', banco: 'largo', A: { hombro: H(90, 4), codo: 18, cadera: 12, rodilla: 88 }, B: { hombro: H(12, 82), codo: 25, cadera: 12, rodilla: 88 } },
  cruce: { base: 'pie', anclar: 'pies', A: { tronco: 15, hombro: H(25, 80), codo: 20 }, B: { tronco: 15, hombro: H(70, 18), codo: 15 } },
  militar: { base: 'pie', anclar: 'pies', A: { hombro: H(0, 82, 90), codo: 105 }, B: { hombro: H(0, 168, 90), codo: 8 } },
  lateral: { base: 'pie', anclar: 'pies', A: { hombro: H(5, 10), codo: 18 }, B: { hombro: H(5, 85), codo: 18 } },
  frontal: { base: 'pie', anclar: 'pies', A: { hombro: H(5, 6), codo: 8 }, B: { hombro: H(92, 6), codo: 8 } },
  pajaro: { base: 'pie', anclar: 'pies', A: { bisagra: 70, rodilla: 20, hombro: H(70, 10), codo: 20 }, B: { bisagra: 70, rodilla: 20, hombro: H(70, 85), codo: 20 } },
  remo: { base: 'pie', anclar: 'pies', A: { bisagra: 55, rodilla: 22, hombro: H(55, 8), codo: 5 }, B: { bisagra: 55, rodilla: 22, hombro: H(-15, 18), codo: 100 } },
  curl: { base: 'pie', anclar: 'pies', A: { hombro: H(4, 6), codo: 8 }, B: { hombro: H(12, 6), codo: 140 } },
  triceps: { base: 'pie', anclar: 'pies', cable: 'alto', A: { tronco: 8, hombro: H(8, 6), codo: 105 }, B: { tronco: 8, hombro: H(5, 6), codo: 8 } },
  muneca: { base: 'sentado', banco: 'asiento', A: { cadera: 90, rodilla: 90, tronco: 30, hombro: H(45, 12), codo: 70, muneca: -40 }, B: { cadera: 90, rodilla: 90, tronco: 30, hombro: H(45, 12), codo: 70, muneca: 45 } },
  encogimiento: { base: 'pie', anclar: 'pies', A: { hombro: H(0, 6), encoger: 0 }, B: { hombro: H(0, 6), encoger: 0.06 } },
  aductor: { base: 'sentado', banco: 'asiento', A: { cadera: 90, rodilla: 90, caderaA: 35, hombro: H(-10, 25), codo: 10 }, B: { cadera: 90, rodilla: 90, caderaA: 4, hombro: H(-10, 25), codo: 10 } },
  cuello: { base: 'pie', anclar: 'pies', A: { cuello: -25, hombro: H(0, 8) }, B: { cuello: 30, hombro: H(0, 8) } },
  correr: { base: 'pie', anclar: 'suelo', A: { tronco: 8, caderaI: 45, rodillaI: 70, caderaD: -18, rodillaD: 35, hombroI: H(-35, 8), hombroD: H(45, 8), codo: 90 }, B: { tronco: 8, caderaD: 45, rodillaD: 70, caderaI: -18, rodillaI: 35, hombroD: H(-35, 8), hombroI: H(45, 8), codo: 90 } },
  bici: { base: 'sentado', banco: 'asiento', A: { tronco: 20, caderaI: 100, rodillaI: 110, caderaD: 55, rodillaD: 60, hombro: H(55, 10), codo: 30 }, B: { tronco: 20, caderaD: 100, rodillaD: 110, caderaI: 55, rodillaI: 60, hombro: H(55, 10), codo: 30 } },
  cardio: { base: 'pie', anclar: 'suelo', A: { hombro: H(0, 12), codo: 10, caderaA: 2 }, B: { hombro: H(0, 165), codo: 10, caderaA: 22, levantar: 0.06 } },
  estira: { base: 'pie', anclar: 'pies', A: { hombro: H(0, 15) }, B: { tronco: 28, hombro: H(150, 20), codo: 5, rodilla: 4 } },
};

/* ---------- El personaje (estilo caricatura: muchacho o muchacha según el perfil) ---------- */
const SEGMUS = { pelvis: ['glúteos', 'abductores', 'aductores'], abd: ['abdomen', 'zona lumbar'], pecho: ['pecho', 'dorsales', 'espalda media', 'trapecio'],
  hombros: ['hombros'], brazo: ['bíceps', 'tríceps'], ante: ['antebrazos'], muslo: ['cuádriceps', 'femorales', 'aductores', 'abductores'], pierna: ['pantorrillas'], cuello: ['cuello', 'trapecio'] };
const PAL = { piel: 0xF2B48C, pelo: 0x5A3A24, top: 0x8E9BAD, topOsc: 0x5F6B7C, licra: 0x7B8594, licraOsc: 0x4A5260, banda: 0x2E3440,
  blanco: 0xF6F6F6, iris: 0x2F8FEA, negro: 0x14161A, boca: 0x8A3B2E, zapato: { m: 0xF39A3D, f: 0xFF6EB4 }, raya: 0x2E3440 };
function crearMuneco(mus, sexo) {
  const mujer = sexo === 'f', pri = mus[0], sec = new Set(mus.slice(1));
  const brillan = [];
  const mat = (color, seg, r = 0.55) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: r, metalness: 0 });
    if (seg) { const L = SEGMUS[seg] || []; const n = L.includes(pri) ? 1 : L.some(x => sec.has(x)) ? 0.55 : 0; if (n) brillan.push({ m, n }); }
    return m;
  };
  const cap = (r, l, color, seg) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 8, 20), mat(color, seg));
  const esf = (r, color, seg, rough) => new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat(color, seg, rough));
  const caja = (x, y, z, color) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), mat(color));
  const pon = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  const G = () => new THREE.Group();
  const J = { brillan };
  const raiz = J.raiz = G();
  // Cadera con licra
  const pel = cap(0.12, 0.12, PAL.licra, 'pelvis'); pel.rotation.z = 90 * R; pel.scale.set(1, mujer ? 1.08 : 1, 0.9); raiz.add(pel);
  const cint = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.016, 10, 30), mat(PAL.topOsc)); cint.rotation.x = 90 * R; cint.scale.set(1.12, 0.82, 1); pon(cint, 0, 0.07, 0); raiz.add(cint);
  // Tronco con camiseta sin mangas
  J.abd = G(); raiz.add(J.abd);
  const abd = cap(0.112, 0.12, PAL.top, 'abd'); abd.position.y = M.abd / 2; abd.scale.set(1.12, 1, 0.86); J.abd.add(abd);
  J.pecho = G(); J.pecho.position.y = M.abd; J.abd.add(J.pecho);
  const pe = cap(0.14, 0.1, PAL.top, 'pecho'); pe.position.y = 0.13; pe.scale.set(mujer ? 1.28 : 1.45, 1, 0.86); J.pecho.add(pe);
  for (const s of [1, -1]) { const t = caja(0.028, 0.2, 0.02, PAL.topOsc); pon(t, s * 0.075, 0.15, 0.115); t.rotation.z = s * 6 * R; J.pecho.add(t); }
  const cuelloT = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 10, 26), mat(PAL.topOsc)); cuelloT.rotation.x = 90 * R; pon(cuelloT, 0, M.pecho - 0.02, -0.01); J.pecho.add(cuelloT);
  J.hombros = G(); J.pecho.add(J.hombros);
  // Cuello y cabeza grande
  J.cuello = G(); J.cuello.position.y = M.pecho; J.pecho.add(J.cuello);
  J.cuello.add(pon(cap(0.05, 0.05, PAL.piel, 'cuello'), 0, 0.04, 0));
  const cab = G(); cab.position.y = 0.235; cab.scale.setScalar(1.25); J.cuello.add(cab);
  const cr = esf(0.16, PAL.piel); cr.scale.set(0.95, 1, 0.95); cab.add(cr);
  for (const s of [1, -1]) {
    cab.add(pon(esf(0.035, PAL.piel), s * 0.152, 0, 0));
    // Ojos hundidos en la cara (aplanados), para que no se vean saltones
    const ojo = esf(0.034, PAL.blanco, null, 0.25); ojo.scale.set(1, 1.15, 0.35); cab.add(pon(ojo, s * 0.05, 0.005, 0.134));
    const iris = esf(0.022, PAL.iris, null, 0.2); iris.scale.set(1, 1.1, 0.25); cab.add(pon(iris, s * 0.05, 0.003, 0.1425));
    const pup = esf(0.011, PAL.negro, null, 0.2); pup.scale.set(1, 1, 0.25); cab.add(pon(pup, s * 0.05, 0.003, 0.1455));
    cab.add(pon(esf(0.0055, 0xffffff, null, 0.1), s * 0.044, 0.013, 0.148));
    const ceja = cap(0.009, 0.04, PAL.pelo); ceja.rotation.z = (90 - s * 10) * R; pon(ceja, s * 0.052, 0.058, 0.138); cab.add(ceja);
    if (mujer) { const pest = cap(0.004, 0.02, PAL.negro); pest.rotation.z = (90 + s * 25) * R; pon(pest, s * 0.08, 0.03, 0.13); cab.add(pest); }
  }
  cab.add(pon(esf(0.022, PAL.piel), 0, -0.018, 0.155));
  const boca = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 18, Math.PI), mat(PAL.boca)); boca.rotation.z = Math.PI; pon(boca, 0, -0.052, 0.146); cab.add(boca);
  // Pelo
  const pelo = esf(0.168, PAL.pelo, null, 0.7); pelo.scale.set(1, 0.55, 1.02); pon(pelo, 0, 0.09, -0.02); cab.add(pelo);
  if (mujer) {
    for (const [y, z, r] of [[0.07, -0.17, 0.06], [0.0, -0.2, 0.052], [-0.07, -0.21, 0.045], [-0.13, -0.2, 0.035]]) cab.add(pon(esf(r, PAL.pelo, null, 0.7), 0, y, z));
    const liga = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 20), mat(PAL.zapato.f)); pon(liga, 0, 0.06, -0.165); liga.rotation.x = 70 * R; cab.add(liga);
    for (const s of [1, -1]) { const m = esf(0.06, PAL.pelo, null, 0.7); m.scale.set(0.6, 1.1, 0.8); cab.add(pon(m, s * 0.13, 0.02, 0.02)); }
  } else {
    for (const [x, y, z, rx, rz] of [[0, 0.15, 0.08, -55, 0], [0.06, 0.14, 0.06, -45, -25], [-0.055, 0.145, 0.07, -50, 22]]) {
      const t = cap(0.045, 0.06, PAL.pelo); t.rotation.set(rx * R, 0, rz * R); cab.add(pon(t, x, y, z));
    }
  }
  J.espalda = G(); J.espalda.position.set(0, 0.16, -0.13); J.pecho.add(J.espalda);
  J.gluteo = G(); J.gluteo.position.set(0, -0.02, -0.12); raiz.add(J.gluteo);
  const fb = mujer ? 0.88 : 1;
  for (const [L, s] of [['I', 1], ['D', -1]]) {
    const h = J['hombro' + L] = G(); h.position.set(s * (mujer ? 0.175 : M.hx), M.pecho - 0.035, 0); J.hombros.add(h);
    h.add(esf(0.082 * fb, PAL.piel, 'hombros'));
    h.add(pon(cap(0.056 * fb, 0.17, PAL.piel, 'brazo'), 0, -M.brazo / 2, 0));
    h.add(pon(esf(0.062 * fb, PAL.piel, 'brazo'), 0, -0.14, 0.022));
    const c = J['codo' + L] = G(); c.position.y = -M.brazo; h.add(c);
    c.add(pon(cap(0.045 * fb, 0.17, PAL.piel, 'ante'), 0, -M.ante / 2, 0));
    const banda = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * fb, 0.05 * fb, 0.07, 20), mat(PAL.banda)); c.add(pon(banda, 0, -M.ante + 0.04, 0));
    const m = J['muneca' + L] = G(); m.position.y = -M.ante; c.add(m);
    m.add(pon(esf(0.052 * fb, PAL.piel), 0, -0.045, 0));
    const ag = J['agarre' + L] = G(); ag.position.y = -0.05; m.add(ag);
    const k = J['cadera' + L] = G(); k.position.set(s * M.cx, -0.02, 0); raiz.add(k);
    k.add(pon(cap(0.085 * (mujer ? 0.95 : 1), 0.28, PAL.licra, 'muslo'), 0, -M.muslo / 2, 0));
    const r = J['rodilla' + L] = G(); r.position.y = -M.muslo; k.add(r);
    const rod = esf(0.072, PAL.licraOsc); rod.scale.set(1, 1, 0.75); r.add(pon(rod, 0, 0, 0.018));
    r.add(pon(cap(0.064, 0.29, PAL.licra, 'pierna'), 0, -M.pierna / 2, 0));
    const pant = esf(0.068, PAL.licra, 'pierna'); pant.scale.set(1, 1.5, 1); r.add(pon(pant, 0, -0.14, -0.012));
    const t = J['tobillo' + L] = G(); t.position.y = -M.pierna; r.add(t);
    const zap = cap(0.058, 0.13, mujer ? PAL.zapato.f : PAL.zapato.m); zap.rotation.x = 90 * R; zap.scale.set(1.1, 1, 0.85); t.add(pon(zap, 0, -0.045, 0.055));
    t.add(pon(caja(0.125, 0.026, 0.26, PAL.blanco), 0, -0.088, 0.055));
    t.add(pon(caja(0.124, 0.02, 0.07, PAL.raya), 0, -0.03, 0.04));
    const punta = J['punta' + L] = G(); punta.position.set(0, -0.1, 0.18); t.add(punta);
    const talon = J['talon' + L] = G(); talon.position.set(0, -0.1, -0.07); t.add(talon);
  }
  return J;
}

/* ---------- Equipo ---------- */
function crearEquipo(tipo, css) {
  const metal = new THREE.MeshStandardMaterial({ color: css.metal, roughness: 0.35, metalness: 0.6 });
  const disco = new THREE.MeshStandardMaterial({ color: css.disco, roughness: 0.6 });
  const cil = (r, l, m) => { const x = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 20), m); x.rotation.z = 90 * R; return x; };
  const g = new THREE.Group();
  if (tipo === 'barra' || tipo === 'barraZ') {
    const largo = tipo === 'barra' ? 1.7 : 1.15;
    g.add(cil(0.014, largo, metal));
    for (const s of [1, -1]) { const d = cil(tipo === 'barra' ? 0.2 : 0.12, 0.05, disco); d.position.x = s * (largo / 2 - 0.12); g.add(d); }
  } else if (tipo === 'mancuerna') {
    g.add(cil(0.015, 0.14, metal));
    for (const s of [1, -1]) { const d = cil(0.055, 0.06, disco); d.position.x = s * 0.09; g.add(d); }
  } else if (tipo === 'kb') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), disco); b.position.y = -0.1; g.add(b);
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 20, Math.PI), metal); a.position.y = -0.04; g.add(a);
  }
  return g;
}
/* Barra sobre la espalda (sentadilla, zancada, buenos días, pantorrilla): manos junto a la barra */
const ESPALDA = new Set(['sentadilla', 'zancada', 'pantorrilla']);
const conBarraEspalda = (e, pt) => (e.eq === 'barra' || e.eq === 'barra Z') && (ESPALDA.has(pt) || /good_morning/.test(String(e.id).toLowerCase())) && !/front|zercher|overhead|hack|bench|smith/.test(String(e.id).toLowerCase());
function equipoDe(e, p) {
  if (p.prop === 'kb') return 'kb';
  const eq = e.eq || '';
  if (eq === 'barra') return 'barra';
  if (eq === 'barra Z') return 'barraZ';
  if (eq === 'mancuernas') return 'mancuerna';
  if (eq === 'kettlebell') return 'kb';
  return null;
}

/* ---------- Aplicar una pose ---------- */
function aplicar(J, def, p) {
  const r = J.raiz;
  const bis = p.bisagra || 0;
  let rx = (p.rx || 0) + bis, y = M.pelvis;
  if (def.base === 'supino') { rx += -90; y = 0.12; }
  if (def.base === 'prono') { rx += 90; y = 0.45; }
  if (def.base === 'sentado') { y = 0.52; }
  if (def.base === 'colgado') { y = 1.1; }
  if (def.banco === 'largo' && def.base !== 'prono') y = 0.56;
  if (def.banco === 'largo' && def.base === 'prono') y = 0.6;
  r.rotation.set(rx * R, 0, 0);
  r.position.set(0, y + (p.levantar || 0), 0);
  const tr = p.tronco || 0;
  J.abd.rotation.set(tr * 0.55 * R, 0, 0);
  J.pecho.rotation.set(tr * 0.45 * R, 0, 0);
  J.hombros.position.y = p.encoger || 0;
  J.cuello.rotation.set((p.cuello || 0) * R, 0, 0);
  for (const [L, s] of [['I', 1], ['D', -1]]) {
    const h = p['hombro' + L] || p.hombro || H();
    J['hombro' + L].rotation.set(-h.f * R, s * (h.r || 0) * R, s * h.a * R, 'ZXY');
    J['codo' + L].rotation.set(-(p['codo' + L] ?? p.codo ?? 0) * R, 0, 0);
    J['muneca' + L].rotation.set((p.muneca || 0) * R, 0, 0);
    const cf = (p['cadera' + L] ?? p.cadera ?? 0) + bis;
    J['cadera' + L].rotation.set(-cf * R, 0, s * (p.caderaA || 0) * R, 'ZXY');
    J['rodilla' + L].rotation.set((p['rodilla' + L] ?? p.rodilla ?? 0) * R, 0, 0);
    J['tobillo' + L].rotation.set((p.tobillo || 0) * R, 0, 0);
  }
  r.updateMatrixWorld(true);
  // Pies apoyados planos en el suelo cuando el cuerpo está de pie
  if (def.anclar === 'pies' || def.anclar === 'suelo') {
    const q = new THREE.Quaternion();
    for (const L of ['I', 'D']) {
      const t = J['tobillo' + L]; t.parent.getWorldQuaternion(q); t.quaternion.copy(q.invert());
    }
    r.updateMatrixWorld(true);
  }
}
const mezclar = (a, b, t) => {
  if (typeof a === 'number' || typeof b === 'number') return (a || 0) + ((b || 0) - (a || 0)) * t;
  const o = {};
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) o[k] = mezclar((a || {})[k], (b || {})[k], t);
  return o;
};
const suave = t => t * t * (3 - 2 * t);

/* ---------- Montar la escena en un elemento ---------- */
export function montar(el, e, css) {
  const pt = patron(e);
  let def = P[pt] || P.estira;
  const espalda = conBarraEspalda(e, pt);
  // Pesa al pecho (goblet, frontal, zercher)
  const alPecho = (pt === 'sentadilla' || pt === 'zancada') && /goblet|front|zercher|plie/.test(String(e.id).toLowerCase());
  if (alPecho) { const brazos = { hombro: H(38, 14), codo: 138 }; def = { ...def, A: { ...def.A, ...brazos }, B: { ...def.B, ...brazos } }; }
  if (espalda) { const brazos = { hombro: H(8, 78, 180), codo: 98 }; def = { ...def, A: { ...def.A, ...brazos }, B: { ...def.B, ...brazos } }; }
  const ancho = el.clientWidth || 320, alto = el.clientHeight || ancho;
  const ren = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  ren.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  ren.setSize(ancho, alto);
  ren.outputColorSpace = THREE.SRGBColorSpace;
  ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.15;
  el.appendChild(ren.domElement);
  ren.domElement.style.touchAction = 'pan-y';
  const esc = new THREE.Scene();
  esc.add(new THREE.HemisphereLight(0xffffff, 0x3a3f4a, 1.4));
  const sol = new THREE.DirectionalLight(0xfff1e0, 2.2); sol.position.set(2, 4, 3.5); esc.add(sol);
  const borde = new THREE.DirectionalLight(0xbfd6ff, 1.2); borde.position.set(-2.5, 2.5, -3); esc.add(borde);
  // Colchoneta de gimnasio
  const suelo = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 2.3), new THREE.MeshStandardMaterial({ color: css.suelo, roughness: 0.9 }));
  suelo.position.y = -0.011; esc.add(suelo);

  const J = crearMuneco(e.mus || [], css.sexo);
  const mundo = new THREE.Group(); mundo.add(J.raiz); esc.add(mundo);

  // Banco o asiento
  const banco = new THREE.MeshStandardMaterial({ color: css.banco, roughness: 0.8 });
  if (def.banco === 'largo') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 1.15), banco); b.position.set(0, 0.21, def.base === 'prono' ? 0.1 : -0.42); mundo.add(b); }
  if (def.banco === 'asiento') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.4), banco); b.position.set(0, 0.21, 0.02); mundo.add(b); }
  if (def.banco === 'respaldo') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.7), banco); b.position.set(0, 0.5, -0.2); b.rotation.x = 45 * R; mundo.add(b); }

  // Equipo en las manos
  const tipo = equipoDe(e, def);
  let barra = null; const manc = [];
  if (tipo === 'barra' || tipo === 'barraZ' || tipo === 'kb') { barra = crearEquipo(tipo, css); mundo.add(barra); }
  if (tipo === 'mancuerna') for (const L of ['I', 'D']) { const m = crearEquipo('mancuerna', css); J['agarre' + L].add(m); manc.push(m); }
  // Cable de polea
  let cable = null;
  const cruce = pt === 'cruce' && e.eq === 'polea';
  if (e.eq === 'polea') {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    cable = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: css.metal }));
    mundo.add(cable);
  }
  const fijo = new THREE.Group(); mundo.add(fijo); // barra de dominadas, paralelas

  const v = new THREE.Vector3(), w = new THREE.Vector3();
  let ref = null;
  const pies = [J.puntaI, J.puntaD, J.talonI, J.talonD];
  const marcas = () => def.anclar === 'manos' ? [J.agarreI, J.agarreD] : def.anclar === 'puntas' ? [J.puntaI, J.puntaD] : def.base === 'supino' ? [...pies, J.espalda, J.gluteo] : pies;
  function pose(t) {
    aplicar(J, def, mezclar(def.A, def.B, t));
    if (def.anclar && def.anclar !== 'espalda') {
      const ms = marcas();
      let minY = Infinity; v.set(0, 0, 0);
      for (const m of ms) { m.getWorldPosition(w); minY = Math.min(minY, w.y); v.add(w); }
      v.divideScalar(ms.length);
      if (def.base === 'supino' && def.anclar === 'pies') { v.set(0, 0, 0); for (const m of pies) { m.getWorldPosition(w); v.add(w); } v.divideScalar(4); }
      if (def.anclar === 'manos') {
        if (!ref) ref = v.clone();
        J.raiz.position.add(w.set(ref.x - v.x, ref.y - v.y, ref.z - v.z));
      } else {
        if (!ref) ref = new THREE.Vector3(v.x, 0, v.z);
        J.raiz.position.add(w.set(ref.x - v.x, -minY, ref.z - v.z));
      }
      J.raiz.updateMatrixWorld(true);
    }
    if (barra && espalda) { J.pecho.localToWorld(v.set(0, M.pecho - 0.02, -0.11)); barra.position.copy(v); }
    else if (barra) {
      J.agarreI.getWorldPosition(v); J.agarreD.getWorldPosition(w);
      barra.position.copy(v).add(w).multiplyScalar(0.5);
    }
    if (cable) {
      const a = cable.geometry.attributes.position;
      J.agarreI.getWorldPosition(v); J.agarreD.getWorldPosition(w);
      if (cruce) { a.setXYZ(0, v.x, v.y, v.z); a.setXYZ(1, 0.95, 2.1, -0.25); a.setXYZ(2, w.x, w.y, w.z); a.setXYZ(3, -0.95, 2.1, -0.25); }
      else {
        v.add(w).multiplyScalar(0.5);
        const alto = def.cable === 'alto' || /pushdown|pulldown|face|high/.test(String(e.id).toLowerCase());
        a.setXYZ(0, v.x, v.y, v.z); a.setXYZ(1, 0, alto ? 2.3 : 0.15, alto ? 0.25 : 0.7); a.setXYZ(2, v.x, v.y, v.z); a.setXYZ(3, v.x, v.y, v.z);
      }
      a.needsUpdate = true;
    }
  }
  // Barra fija / paralelas: se ponen donde quedan las manos al inicio
  pose(0);
  if (def.prop === 'barrafija' || def.prop === 'paralelas') {
    const metal = new THREE.MeshStandardMaterial({ color: css.metal, metalness: 0.6, roughness: 0.35 });
    J.agarreI.getWorldPosition(v);
    if (def.prop === 'barrafija') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.4, 16), metal); b.rotation.z = 90 * R; b.position.set(0, v.y, v.z); fijo.add(b); }
    else for (const s of [1, -1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 16), metal); b.rotation.x = 90 * R; b.position.set(s * Math.abs(v.x), v.y - 0.03, v.z); fijo.add(b); }
  }

  // Encuadre: medir la figura en varias fases del movimiento
  const caja = new THREE.Box3(), tmp = new THREE.Box3();
  for (const t of [0, 0.5, 1]) { pose(t); tmp.setFromObject(mundo); caja.union(tmp); }
  
  const centro = caja.getCenter(new THREE.Vector3()), tam = caja.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(32, ancho / alto, 0.05, 50);
  const dist = Math.max(tam.y * 1.05, Math.max(tam.x, tam.z) * 0.95) / (2 * Math.tan(16 * R)) * 1.12 + 0.35;
  let az = def.base === 'pie' || def.base === 'colgado' ? 32 : 62, el2 = 10;
  const ubicar = () => { cam.position.set(centro.x + dist * Math.sin(az * R) * Math.cos(el2 * R), centro.y + dist * Math.sin(el2 * R), centro.z + dist * Math.cos(az * R) * Math.cos(el2 * R)); cam.lookAt(centro); };
  ubicar();

  // Girar con el dedo
  let arrastre = null;
  const cv = ren.domElement;
  cv.addEventListener('pointerdown', ev => { arrastre = { x: ev.clientX, az }; cv.setPointerCapture(ev.pointerId); });
  cv.addEventListener('pointermove', ev => { if (!arrastre) return; az = arrastre.az - (ev.clientX - arrastre.x) * 0.6; ubicar(); if (!corriendo) dibujar(); });
  const soltar = () => { arrastre = null; };
  cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);

  // Ciclo: sube 1 s, pausa, baja 1,2 s, pausa
  const T = 2800;
  const fase = ms => { const x = (ms % T) / T; if (x < 0.38) return suave(x / 0.38); if (x < 0.48) return 1; if (x < 0.9) return 1 - suave((x - 0.48) / 0.42); return 0; };
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let corriendo = !quieto, t0 = performance.now(), pausadoEn = 0, raf = 0, vivo = true;
  function dibujar() { ren.render(esc, cam); }
  // Los músculos que trabajan brillan, más fuerte cuando hacen el esfuerzo
  function brillo(f) { for (const { m, n } of J.brillan) { m.emissive.setHex(n === 1 ? 0xff3b2f : 0xff9a2f); m.emissiveIntensity = (0.22 + 0.55 * f) * n; } }
  function cuadro(now) {
    if (!vivo) return;
    if (!el.isConnected) return destruir();
    if (corriendo) { const f = fase(now - t0); pose(f); brillo(f); dibujar(); }
    raf = requestAnimationFrame(cuadro);
  }
  pose(quieto ? 1 : 0); brillo(quieto ? 1 : 0); dibujar();
  raf = requestAnimationFrame(cuadro);
  function pausar(si) { if (si === corriendo) { if (si) { corriendo = false; pausadoEn = performance.now(); } else { t0 += performance.now() - pausadoEn; corriendo = true; } } return corriendo; }
  function destruir() {
    vivo = false; cancelAnimationFrame(raf);
    esc.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => m.dispose()); });
    ren.dispose(); cv.remove();
  }
  const ver = t => { corriendo = false; pose(t); brillo(t); dibujar(); };
  return { ver, pausar: () => pausar(true), seguir: () => pausar(false), alternar: () => pausar(corriendo), destruir, patron: patron(e), get corriendo() { return corriendo; } };
}
