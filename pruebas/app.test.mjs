// Prueba de punta a punta: la app real (copia conectada a los emuladores) con las reglas de seguridad.
// Se corre con:  bash pruebas/correr.sh
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const NM = new URL('./node_modules/firebase/', import.meta.url).pathname;
const CHROMIUM = process.env.CHROMIUM || undefined;
const OUT = process.argv[2] || new URL('./capturas', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: CHROMIUM });
const problemas = [];
let paso = 0;
async function nueva(nombre) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent: process.env.IPHONE ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined, serviceWorkers: 'block' });
  await ctx.route(u => !u.href.startsWith('http://127.0.0.1:'), async r => {
    const u = r.request().url();
    if (u.startsWith('https://www.gstatic.com/firebasejs/')) return r.fulfill({ path: NM + u.split('/').pop(), contentType: 'text/javascript' });
    if (u.startsWith('http://localhost:8766/')) return r.continue();
    return r.abort(); // fuentes y fotos externas: no hacen falta para la prueba
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => problemas.push(`[${nombre}] error JS: ${e.message}`));
  p.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to/.test(t)) problemas.push(`[${nombre}] CSP: ${t.slice(0, 200)}`); });
  await p.goto('http://localhost:8766/');
  return p;
}
const ver = async (p, texto, ms = 15000) => { try { await p.getByText(texto, { exact: false }).first().waitFor({ timeout: ms }); } catch (e) { await p.screenshot({ path: OUT + "/fallo.png" }); throw new Error("No apareció: " + texto + " | pantalla: " + (await p.innerText("body")).slice(0, 300).replace(/\n/g, " / ")); } };
async function foto(p, n) { await p.screenshot({ path: `${OUT}/e2e-${String(++paso).padStart(2, '0')}-${n}.png` }); }
async function crearCuenta(p, nombre, mail, sexo) {
  await p.getByText('Soy nuevo: crear cuenta').click();
  await p.fill('#anom', nombre); await p.fill('#amail', mail);
  if (sexo) await p.getByRole('radio', { name: sexo }).click();
  await p.fill('#aclave', '12345678'); await p.click('#abtn');
  await ver(p, 'no sea solo números');
  await p.fill('#aclave', 'Pesas-2026!'); await p.click('#abtn');
}

try {
  // 1. Coach
  const C = await nueva('coach');
  await ver(C, 'Tu plan.');
  await foto(C, 'login');
  await crearCuenta(C, 'Gene', 'coach@genefit.test', 'Hombre');
  await ver(C, 'Configura Genefit');
  await C.getByText('Soy el coach').click();
  await ver(C, 'Mis clientes');
  await C.evaluate(() => irA('rutinas'));
  await C.getByText('Agregar Empuje, Tirón y Pierna de ejemplo').click();
  await ver(C, 'Pierna completa');

  // 2. Cliente
  const K = await nueva('cliente');
  await crearCuenta(K, 'Ana Pérez', 'ana@genefit.test', 'Mujer');
  await ver(K, 'Hola, Ana');
  const temaAna = await K.evaluate(() => document.body.className);
  if (!/tema-f/.test(temaAna)) problemas.push('Ana (mujer) no quedó en rosa: ' + temaAna);
  const temaCoach = await C.evaluate(() => document.body.className);
  if (/tema-/.test(temaCoach)) problemas.push('El panel del coach tomó un color de cliente: ' + temaCoach);
  await ver(K, 'Tu coach aún no te asigna rutina');

  // 3. Coach asigna
  await C.evaluate(() => irA('clientes'));
  await ver(C, 'Ana Pérez');
  await C.evaluate(() => { const p = S.plantillas.find(x => x.nombre === 'Empuje'); const c = S.clientes.find(x => x.alias === 'Ana Pérez'); abrirAsignar(p.id, c.id); });
  await C.getByText('Asignar a 1 cliente').click();
  await ver(C, 'asignada a 1 cliente');

  // 4. Cliente entrena y guarda
  await ver(K, 'Empuje');
  await K.getByRole('button', { name: 'Empezar' }).first().click();
  await ver(K, 'Agregar serie');
  // Etapa 2: tipo de serie, RPE, superserie
  await K.evaluate(() => menuSerie(0, 0));
  await K.getByRole('radio', { name: 'Calentamiento' }).click();
  await K.getByRole('button', { name: '8,5' }).click();
  await K.getByRole('button', { name: 'Listo' }).click();
  const et = await K.evaluate(() => [etiqueta(S.ses.ejercicios[0].sets, 0), etiqueta(S.ses.ejercicios[0].sets, 1), S.ses.ejercicios[0].sets[0].rpe]);
  if (JSON.stringify(et) !== '["C","1",8.5]') problemas.push('Etiquetas de serie mal: ' + JSON.stringify(et));
  await K.evaluate(() => menuEj(0));
  await K.getByRole('button', { name: /Hacer superserie con/ }).click();
  await K.getByRole('button', { name: 'Listo' }).click();
  await ver(K, 'Superserie A');
  await K.evaluate(() => marcar(0, 1));
  const desc1 = await K.evaluate(() => S.ses.descFin);
  if (desc1) problemas.push('En superserie no debía arrancar el descanso');
  await K.evaluate(() => marcar(1, 0));
  const desc2 = await K.evaluate(() => S.ses.descFin > Date.now());
  if (!desc2) problemas.push('Al cerrar la vuelta de superserie debía arrancar el descanso');
  await K.evaluate(() => { marcar(0, 0); marcar(0, 2); });
  await foto(K, 'sesion');
  await K.evaluate(() => abrirTerminar());
  await K.click('#btnGuardar');
  await ver(K, 'récord');
  const guardado = await K.evaluate(() => S.hist[0]?.detalle?.[0]?.sets);
  if (!guardado || guardado[0].t !== 'w' || guardado[0].rpe !== 8.5) problemas.push('No se guardó tipo/RPE: ' + JSON.stringify(guardado));
  // medidas privadas
  await K.evaluate(() => irA('progreso'));
  await K.fill('#m-peso', '72.5'); await K.getByText('Guardar medidas').click();
  await ver(K, 'Medidas guardadas');
  // mensaje
  await K.evaluate(() => irA('coach'));
  await K.fill('#msgIn', 'Hola coach, ya entrené'); await K.getByRole('button', { name: 'Enviar' }).click();
  await ver(K, 'Hola coach, ya entrené');

  // 5. Coach ve el entreno, el mensaje, y no ve las medidas privadas
  await C.evaluate(() => { const c = S.clientes.find(x => x.alias === 'Ana Pérez'); abrirCliente(c.id); });
  await ver(C, 'Últimos entrenamientos');
  await ver(C, 'Empuje');
  await ver(C, 'no comparte sus medidas');
  await foto(C, 'detalle-cliente');
  await C.evaluate(() => { const c = S.clientes.find(x => x.alias === 'Ana Pérez'); abrirChat(c.id); });
  await ver(C, 'Hola coach, ya entrené');
  await C.fill('#msgIn', '¡Bien hecho!'); await C.getByRole('button', { name: 'Enviar' }).click();
  await ver(K, '¡Bien hecho!');

  // 6. Pago vencido corta el acceso
  await C.evaluate(() => { cerrarChat(); });
  await C.getByText('Pagó: +1 mes').click();
  await ver(C, 'Pago registrado');
  await C.evaluate(() => { const c = S.clientes.find(x => x.alias === 'Ana Pérez'); return S.db.doc('acceso/' + c.id).set({ pagoHasta: Date.now() - 1000 }, { merge: true }); });
  await ver(K, 'Tu mensualidad venció');
  await foto(K, 'vencido');
  await C.getByText('Pagó: +1 mes').click();
  await ver(K, 'Rutinas que te asignó');

  // 7. Salir borra los datos del teléfono
  await K.evaluate(() => iniciar('libre'));
  await K.evaluate(() => { salir(); salir(); });
  await ver(K, 'Tu plan.');
  const resto = await K.evaluate(async () => ({ ses: localStorage.getItem('hierro2-sesion'), dbs: (await indexedDB.databases()).map(d => d.name) }));
  console.log('Después de salir:', JSON.stringify(resto));
  if (resto.ses) problemas.push('Quedó el entreno en curso guardado tras salir');
  if (resto.dbs.some(n => /firestore/.test(n) && /main/.test(n))) problemas.push('Quedó la copia de Firestore tras salir: ' + resto.dbs.join(','));
  await foto(K, 'tras-salir');
  console.log('Flujo completo OK');
} catch (e) {
  for (const pg of b.contexts().flatMap(c => c.pages())) await pg.screenshot({ path: OUT + '/fallo-' + Math.random().toString(36).slice(2, 6) + '.png' }).catch(() => {});
  problemas.push('FALLÓ el flujo: ' + e.message.split('\n').slice(0, 3).join(' | '));
}
console.log(problemas.length ? 'PROBLEMAS:\n' + problemas.join('\n') : 'Sin problemas');
await b.close();
process.exit(problemas.length ? 1 : 0);
