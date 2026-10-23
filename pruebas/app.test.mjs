// Prueba de punta a punta: la app real (copia conectada a los emuladores) con las reglas de seguridad.
// Se corre con:  bash pruebas/correr.sh
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const NM = new URL('./node_modules/firebase/', import.meta.url).pathname;
const CHROMIUM = process.env.CHROMIUM || undefined;
const OUT = process.argv[2] || new URL('./capturas', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problemas = [];
const ntfy = [];
let paso = 0;
async function nueva(nombre) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent: process.env.IPHONE ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined, serviceWorkers: 'block' });
  await ctx.route(u => !u.href.startsWith('http://127.0.0.1:'), async r => {
    const u = r.request().url();
    if (u.startsWith('https://www.gstatic.com/firebasejs/')) return r.fulfill({ path: NM + u.split('/').pop(), contentType: 'text/javascript' });
    if (u.startsWith('http://localhost:8766/')) return r.continue();
    if (u.startsWith('https://ntfy.sh/')) { ntfy.push(r.request().postData() || ''); return r.fulfill({ status: 200, body: '{}' }); }
    return r.abort(); // fuentes y fotos externas: no hacen falta para la prueba
  });
  const p = await ctx.newPage();
  if (nombre === 'cliente') { const cdp = await ctx.newCDPSession(p); await cdp.send('WebAuthn.enable'); await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } }); }
  p.on('pageerror', e => problemas.push(`[${nombre}] error JS: ${e.message}`));
  p.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to/.test(t)) problemas.push(`[${nombre}] CSP: ${t.slice(0, 200)}`); });
  await p.goto('http://localhost:8766/');
  return p;
}
const ver = async (p, texto, ms = 15000) => { try { await p.getByText(texto, { exact: false }).first().waitFor({ timeout: ms }); } catch (e) { await p.screenshot({ path: OUT + "/fallo.png" }); throw new Error("No apareció: " + texto + " | pantalla: " + (await p.innerText("body")).slice(0, 300).replace(/\n/g, " / ")); } };
async function foto(p, n) { await p.screenshot({ path: `${OUT}/e2e-${String(++paso).padStart(2, '0')}-${n}.png`, fullPage: true }); }
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
  await ver(C, 'Entrena');
  await foto(C, 'login');
  await crearCuenta(C, 'Gene', 'coach@genefit.test', 'Hombre');
  await ver(C, 'Configura Genefit');
  await C.getByText('Soy el coach').click();
  await ver(C, 'Mis clientes');
  await C.evaluate(() => irA('rutinas'));
  await C.getByText('Agregar Empuje, Tirón y Pierna de ejemplo').click();
  await ver(C, 'Pierna completa');

  // Avisos de clientes nuevos con ntfy
  await C.evaluate(() => irA('clientes'));
  await C.locator('details.card', { hasText: 'Avisos de clientes nuevos' }).getByRole('button', { name: 'Activar', exact: true }).click();
  await ver(C, 'suscríbete al tema');
  await C.waitForTimeout(300); await C.locator('details.card', { hasText: 'Avisos de clientes nuevos' }).scrollIntoViewIfNeeded().catch(() => {});
  await foto(C, 'avisos-ntfy');
  await C.getByRole('button', { name: 'Enviar prueba' }).click();
  await C.waitForTimeout(500);
  if (!ntfy.some(b => /Prueba/.test(b))) problemas.push('No se envió la prueba a ntfy');

  // 2. Cliente
  const K = await nueva('cliente');
  await crearCuenta(K, 'Ana Pérez', 'ana@genefit.test', 'Mujer');
  await ver(K, 'Hola, Ana');
  await ver(K, 'Soy Génesis, tu entrenadora. Bienvenida');
  await foto(K, 'saludo');
  await K.getByRole('button', { name: '¡Vamos!' }).click();
  await ver(C, 'Nuevo cliente: Ana Pérez');
  await K.waitForTimeout(500);
  const aviso = ntfy.find(b => /cliente nuevo/.test(b));
  if (!aviso) problemas.push('No llegó el aviso de cliente nuevo a ntfy');
  else if (/Ana/.test(aviso)) problemas.push('El aviso de ntfy no debe llevar el nombre');
  // Entrar con huella
  await K.evaluate(() => scrollTo(0, 0));
  await foto(K, 'oferta-huella');
  await foto(C, 'aviso-nuevo');
  await K.getByRole('button', { name: 'Activar' }).click();
  await ver(K, 'La próxima vez entras con tu huella');
  await K.evaluate(() => sessionStorage.removeItem('gf-desbloq'));
  await K.reload();
  await ver(K, 'Confirma que eres tú');
  await foto(K, 'huella');
  await K.getByRole('button', { name: /Entrar con huella/ }).click();
  await ver(K, 'Hola, Ana');
  const temaAna = await K.evaluate(() => document.body.className);
  if (!/tema-f/.test(temaAna)) problemas.push('Ana (mujer) no quedó en rosa: ' + temaAna);
  const temaCoach = await C.evaluate(() => document.body.className);
  if (/tema-/.test(temaCoach)) problemas.push('El panel del coach tomó un color de cliente: ' + temaCoach);
  await ver(K, 'Génesis aún no te asigna rutina');

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
  // Ficha del ejercicio: por ahora muestra las fotos (3D apagado)
  await K.evaluate(() => abrirFicha(S.ses.ejercicios[0].nombre));
  await ver(K, 'Cómo se hace');
  if (await K.locator('#v3d').count()) problemas.push('La ficha no debía mostrar el 3D');
  if (!(await K.locator('#ficha .foto').count())) problemas.push('La ficha no muestra las fotos');
  await K.evaluate(() => cerrarFicha());
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
  // Calculadora de discos (press de banca a 60 kg → 20 kg por lado) y calentamiento automático
  await K.evaluate(() => { cerrarHoja(); menuEj(0); });
  await K.getByRole('button', { name: 'Calculadora de discos' }).click();
  await ver(K, 'En cada lado');
  const lado = await K.locator('#sheet .tile b').first().innerText();
  if (lado.trim() !== '20 kg') problemas.push('Discos por lado: esperaba 20 kg y dio ' + lado);
  await foto(K, 'discos');
  await K.evaluate(() => { cerrarHoja(); menuEj(3); });
  await K.getByRole('button', { name: 'Agregar calentamiento' }).click();
  const cal = await K.evaluate(() => S.ses.ejercicios[3].sets.filter(x => x.t === 'w').map(x => x.kg));
  if (JSON.stringify(cal) !== '[8,12,16]') problemas.push('Calentamiento: esperaba [8,12,16] y dio ' + JSON.stringify(cal));
  // Ejercicio por tiempo: plancha de 1:15
  await K.evaluate(() => { const m = modoDe('Plancha'); S.ses.ejercicios.push({ k: uid(), nombre: 'Plancha', modo: m, desc: 60, sig: false, nota: '', sets: [{ ...serieNueva(m), ok: false, t: 'n' }] }); render(); const i = S.ses.ejercicios.length - 1; setSet(i, 0, 'min', 1); setSet(i, 0, 'segs', 15); marcar(i, 0); S.ses.descFin = 0; render(); });
  await ver(K, 'Min');
  await foto(K, 'sesion');
  await K.evaluate(() => abrirTerminar());
  await K.click('#btnGuardar');
  await ver(K, 'récord');
  await ver(K, '¡Buen entreno!');
  await K.waitForSelector('#resImg');
  await foto(K, 'compartir');
  const descarga = K.waitForEvent('download', { timeout: 10000 }).catch(() => null);
  await K.getByRole('button', { name: 'Guardar imagen' }).click();
  if (!(await descarga)) problemas.push('No se descargó la imagen del entreno');
  await K.evaluate(() => cerrarHoja());
  const plancha = await K.evaluate(() => S.hist[0]?.detalle?.find(e => e.nombre === 'Plancha'));
  if (!plancha || plancha.modo !== 'tiempo' || plancha.sets[0].seg !== 75) problemas.push('No se guardó la plancha por tiempo: ' + JSON.stringify(plancha));
  const guardado = await K.evaluate(() => S.hist[0]?.detalle?.[0]?.sets);
  if (!guardado || guardado[0].t !== 'w' || guardado[0].rpe !== 8.5) problemas.push('No se guardó tipo/RPE: ' + JSON.stringify(guardado));
  // Etapa 3: segundo entreno y estadísticas
  await K.evaluate(() => iniciar('asig', S.asig[0].id));
  await ver(K, 'Agregar serie');
  const sg = await K.evaluate(() => [S.ses.ejercicios[0].sug?.accion, S.ses.ejercicios[0].sets[1].kg]);
  if (sg[0] !== 'sube' || sg[1] !== 62.5) problemas.push('Progresión automática: esperaba subir a 62,5 y dio ' + JSON.stringify(sg));
  await ver(K, 'Sube 2,5 kg');
  await foto(K, 'progresion');
  await K.evaluate(() => { S.ses.ejercicios[0].sets[0].kg = 65; marcar(0, 0); marcar(0, 1); S.ses.descFin = 0; abrirTerminar(); });
  await K.click('#btnGuardar');
  await K.waitForFunction(() => !S.ses && S.hist.length === 2, null, { timeout: 15000 });
  await K.evaluate(() => cerrarHoja());
  await K.evaluate(() => { S.progTab = 'resumen'; irA('progreso'); });
  await ver(K, 'Por semana'); await ver(K, 'Series por músculo'); await ver(K, 'Pecho');
  await K.getByRole('button', { name: /entrenos?$/ }).first().click();
  await ver(K, 'Empuje ·');
  await foto(K, 'prog-resumen');
  await K.getByRole('tab', { name: 'Ejercicios' }).click();
  await K.getByRole('button', { name: /Press de banca/ }).first().click();
  await ver(K, 'El 1RM estimado es');
  const puntos = await K.locator('#gej .pt').count();
  if (puntos !== 2) problemas.push('La gráfica del ejercicio debía tener 2 puntos y tiene ' + puntos);
  await foto(K, 'prog-ejercicio');
  await K.evaluate(() => { S.vista = null; S.progTab = 'historial'; render(); });
  await K.locator('details.hrow summary').first().click();
  await ver(K, '65×8');
  await foto(K, 'prog-historial');
  // Editar un entreno guardado
  const idEd = await K.evaluate(() => S.hist[0].id);
  await K.locator('details.hrow[open]').getByRole('button', { name: 'Editar' }).click();
  await ver(K, 'Editando:');
  await K.evaluate(() => { setSet(0, 0, 'kg', 67.5); abrirTerminar(); });
  await K.fill('#fmin', '48');
  await K.click('#btnGuardar');
  await ver(K, 'Cambios guardados');
  await K.waitForFunction(id => { const h = S.hist.find(x => x.id === id); return h && h.min === 48 && h.detalle[0].sets[0].kg === 67.5; }, idEd, { timeout: 15000 });
  if (await K.evaluate(() => S.hist.length) !== 2) problemas.push('Editar no debía crear otro entreno');
  // Borrar un entreno (uno de prueba)
  await K.evaluate(() => { iniciar('libre'); const m = 'kg'; S.ses.ejercicios.push({ k: uid(), nombre: 'Curl con barra', modo: m, desc: 0, sig: false, nota: '', sets: [{ kg: 20, reps: 10, ok: true, t: 'n' }] }); abrirTerminar(); });
  await K.click('#btnGuardar');
  await K.waitForFunction(() => !S.ses && S.hist.length === 3, null, { timeout: 15000 });
  await K.evaluate(() => { cerrarHoja(); S.tab = 'progreso'; S.progTab = 'historial'; render(); });
  await K.locator('details.hrow summary').first().click();
  await K.locator('details.hrow[open]').getByRole('button', { name: 'Borrar' }).click();
  await K.locator('details.hrow[open]').getByRole('button', { name: 'Toca otra vez para borrar' }).click();
  await K.waitForFunction(() => S.hist.length === 2, null, { timeout: 15000 });
  await K.evaluate(() => { S.progTab = 'cuerpo'; render(); });
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
  await C.getByRole('tab', { name: 'Cuerpo' }).click();
  await ver(C, 'no comparte sus medidas');
  await C.getByRole('tab', { name: 'Resumen' }).click();
  await foto(C, 'detalle-cliente');
  await C.evaluate(() => { const c = S.clientes.find(x => x.alias === 'Ana Pérez'); abrirChat(c.id); });
  await ver(C, 'Hola coach, ya entrené');
  await C.fill('#msgIn', '¡Bien hecho!'); await C.getByRole('button', { name: 'Enviar' }).click();
  await ver(K, '¡Bien hecho!');

  // Etapa 4: el coach ve estadísticas, ajusta la rutina solo para Ana, duplica y comenta
  await C.evaluate(() => cerrarChat());
  await C.waitForFunction(() => S.clientes.find(x => x.alias === 'Ana Pérez')?.tend?.ses30 === 2, null, { timeout: 15000 });
  await C.evaluate(() => { S.filtro = 'progresan'; irA('clientes'); });
  await ver(C, 'récords en 30 días');
  await foto(C, 'coach-lista');
  await C.evaluate(() => { const c = S.clientes.find(x => x.alias === 'Ana Pérez'); abrirCliente(c.id); });
  await C.getByRole('tab', { name: 'Progreso' }).click();
  await ver(C, 'Entrenos en 30 días'); await ver(C, 'Series por músculo');
  await foto(C, 'coach-progreso');
  await C.getByRole('button', { name: /Press de banca/ }).first().click();
  await ver(C, 'El 1RM estimado es');
  await C.evaluate(() => cerrarEj());
  await C.getByRole('tab', { name: 'Resumen' }).click();
  await C.getByRole('button', { name: 'Ajustar' }).first().click();
  await ver(C, 'solo para este cliente');
  await C.fill('#e0kg', '62.5'); await C.getByText('Guardar rutina').click();
  await ver(C, 'Rutina ajustada');
  await K.waitForFunction(() => S.asig[0]?.ejercicios?.[0]?.kg === 62.5, null, { timeout: 15000 });
  const plantillaIgual = await C.evaluate(() => S.plantillas.find(p => p.nombre === 'Empuje').ejercicios[0].kg);
  if (plantillaIgual !== 60) problemas.push('Ajustar para un cliente cambió la plantilla: ' + plantillaIgual);
  const asigBien = await K.evaluate(() => { const a = S.asig[0]; return !!a.plantilla && Array.isArray(a.dias); });
  if (!asigBien) problemas.push('Ajustar borró los días o la plantilla de la asignación');
  await C.locator('details.hrow summary').first().click();
  await C.getByRole('button', { name: /Comentar este entreno/ }).click();
  const pre = await C.inputValue('#msgIn');
  if (!/^Sobre tu entreno «Empuje»/.test(pre)) problemas.push('El comentario no se prellenó: ' + pre);
  await C.evaluate(() => { cerrarChat(); irA('rutinas'); });
  await C.getByRole('button', { name: 'Duplicar' }).first().click();
  await ver(C, '(copia)');
  const t = await C.evaluate(() => tendencias([1, 2, 3, 4, 5].map(i => ({ fecha: Date.now() - i * DIA, prs: [], detalle: [{ nombre: 'Sentadilla', sets: [{ kg: i > 3 ? 100 : 95, reps: 5 }] }] }))));
  if (JSON.stringify(t.estanc) !== '["Sentadilla"]') problemas.push('No detectó estancamiento: ' + JSON.stringify(t));
  await C.evaluate(() => { const c = S.clientes.find(x => x.alias === 'Ana Pérez'); abrirCliente(c.id); });

  // Únicas: mapa de dolor
  await K.evaluate(() => { irA('hoy'); });
  await K.getByRole('button', { name: /¿Te duele algo\?/ }).click();
  await ver(K, '¿Dónde te duele?');
  await K.getByRole('button', { name: /^hombros/ }).click();
  await K.getByRole('button', { name: /^hombros/ }).click();
  await K.fill('#dnota', 'Molestia al empujar');
  await foto(K, 'dolor-mapa');
  await K.getByRole('button', { name: 'Guardar' }).click();
  await ver(K, 'hombros (moderado)');
  await ver(K, 'cargan zonas donde te duele');
  await K.evaluate(() => iniciar('asig', S.asig[0].id));
  await ver(K, 'donde te duele.');
  await foto(K, 'dolor-sesion');
  const iAviso = await K.evaluate(() => S.ses.ejercicios.findIndex(e => enRiesgo(e.nombre).length));
  await K.evaluate(i => verAlternativas(i), iAviso);
  await K.locator('#sheet .pick').first().click();
  const sigue = await K.evaluate(i => enRiesgo(S.ses.ejercicios[i].nombre).length, iAviso);
  if (sigue) problemas.push('La alternativa también carga la zona con dolor');
  await K.evaluate(() => { S.ses = null; guardarSes(); S.vista = null; render(); });
  await C.evaluate(() => { const c = S.clientes.find(x => x.alias === 'Ana Pérez'); abrirCliente(c.id); });
  await ver(C, 'Reporta dolor');
  await ver(C, 'Molestia al empujar');

  // Únicas: retos
  await C.evaluate(() => { cerrarCliente(); irA('clientes'); });
  await C.getByRole('button', { name: '+ Nuevo reto' }).click();
  await C.fill('#rt-t', 'Noviembre sin fallar');
  await C.getByRole('button', { name: 'Crear reto' }).click();
  await ver(C, 'Reto creado');
  await K.evaluate(() => irA('hoy'));
  await ver(K, 'Noviembre sin fallar');
  await K.getByRole('button', { name: 'Unirme' }).click();
  await ver(K, 'Ana Pérez (tú)');
  await foto(K, 'reto-ranking');
  await K.evaluate(() => cerrarHoja());
  await C.getByRole('button', { name: 'Ranking' }).first().click();
  await ver(C, 'Ana Pérez');
  await C.evaluate(() => cerrarHoja());

  // Sesiones: el coach pone SINPE y precio; la clienta compra, adjunta comprobante y descuenta; el coach solo ve
  const png = { name: 'comprobante.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') };
  await C.evaluate(() => irA('pagos'));
  await C.fill('#sp-tel', '8888-1234'); await C.fill('#sp-monto', '8000'); await C.fill('#sp-tit', 'Gene Fit');
  await C.getByRole('button', { name: 'Guardar datos de cobro' }).click();
  await ver(C, 'Datos de cobro guardados');
  await K.evaluate(() => irA('hoy'));
  await ver(K, 'Tus sesiones con Génesis');
  await K.getByRole('button', { name: 'Comprar sesiones' }).click();
  await ver(K, '₡80'); await ver(K, '8888-1234');
  await K.fill('#cp-ref', '2026102299887766');
  await K.setInputFiles('#cp-img', png);
  await ver(K, 'Comprobante listo');
  await foto(K, 'comprar-sesiones');
  await K.getByRole('button', { name: 'Comprar 10 sesiones' }).click();
  await ver(K, 'de 10 te quedan');
  await K.getByRole('button', { name: 'Usé una sesión' }).click();
  await K.fill('#us-t', '2026-10-20T18:30'); await K.fill('#us-n', 'Pierna');
  await K.getByRole('button', { name: 'Descontar 1 sesión' }).click();
  await K.waitForFunction(() => sesDe(S.perfil).rest === 9, null, { timeout: 15000 });
  await K.locator('details', { hasText: 'Ver mis sesiones' }).locator('summary').click();
  await ver(K, 'Pierna');
  await foto(K, 'sesiones-cliente');
  await C.evaluate(() => { const c = S.clientes.find(x => x.alias === 'Ana Pérez'); window.__ana = c.id; abrirCliente(c.id); });
  await ver(C, 'de 10 restantes');
  if (await C.getByRole('button', { name: /Registrar sesión|Usé una sesión|Agregar paquete/ }).count()) problemas.push('El coach no debía poder registrar sesiones');
  await C.locator('details', { hasText: 'Sesiones usadas' }).locator('summary').click();
  await ver(C, 'Pierna');
  await C.locator('details', { hasText: 'Compras (' }).locator('summary').click();
  await ver(C, 'SINPE Móvil');
  await foto(C, 'sesiones-coach');
  await C.getByRole('button', { name: 'Ver', exact: true }).click();
  await ver(C, '2026102299887766');
  await foto(C, 'revisar-comprobante');
  await C.getByRole('button', { name: 'Confirmar: el pago llegó' }).click();
  await ver(C, 'Pago confirmado');
  await K.waitForFunction(() => S.comp[0]?.estado === 'aprobado', null, { timeout: 15000 });
  // Las sesiones que el coach había anotado en la versión anterior pasan solas a la cuenta del cliente
  await C.evaluate(() => S.db.doc('acceso/' + window.__ana).set({ plan: 'sesion', sesCompradas: 5, sesLog: [{ id: 'x1', t: 1760000000000 }] }, { merge: true }));
  await K.evaluate(() => S.db.doc(BASE()).update({ ses: firebase.firestore.FieldValue.delete() }));
  await K.waitForFunction(() => S.perfil?.ses?.compradas === 5 && S.perfil.ses.log.length === 1, null, { timeout: 15000 });

  // Eliminar y reactivar a un cliente (sin mensualidad)
  await C.evaluate(() => { cerrarHoja(); abrirCliente(window.__ana); });
  await C.getByRole('button', { name: 'Eliminar a Ana Pérez' }).click();
  await C.getByRole('button', { name: /Toca otra vez para eliminar/ }).click();
  await ver(C, 'fue eliminado');
  await ver(K, 'Tu cuenta está desactivada');
  await C.evaluate(() => irA('pagos'));
  await ver(C, 'Eliminados');
  await C.getByRole('button', { name: 'Reactivar' }).click();
  await C.waitForFunction(() => { const a = accesoDe(window.__ana); return a && !a.bloqueado; }, null, { timeout: 15000 });
  await ver(K, 'Hola, Ana');
  await C.evaluate(() => { S.filtro = 'todos'; irA('clientes'); });
  await ver(C, 'Ana Pérez');

  // 7. Salir borra los datos del teléfono
  await K.evaluate(() => iniciar('libre'));
  await K.evaluate(() => { salir(); salir(); });
  await ver(K, 'Entrena');
  const resto = await K.evaluate(async () => ({ ses: localStorage.getItem('hierro2-sesion'), dbs: (await indexedDB.databases()).map(d => d.name) }));
  console.log('Después de salir:', JSON.stringify(resto));
  if (resto.ses) problemas.push('Quedó el entreno en curso guardado tras salir');
  if (resto.dbs.some(n => /firestore/.test(n) && /main/.test(n))) problemas.push('Quedó la copia de Firestore tras salir: ' + resto.dbs.join(','));
  await foto(K, 'tras-salir');
  // Olvidé mi clave: correo enviado, aviso de spam y WhatsApp de Génesis
  await K.getByRole('button', { name: 'Olvidé mi clave' }).click();
  await K.fill('#amail', 'ana@genefit.test'); await K.click('#abtn');
  await ver(K, 'Revisa tu correo'); await ver(K, 'spam');
  const wa = await K.getByRole('link', { name: /WhatsApp/ }).getAttribute('href');
  if (!/^https:\/\/wa\.me\/50660252568\?text=.*ana%40genefit\.test/.test(wa)) problemas.push('Enlace de WhatsApp mal: ' + wa);
  await foto(K, 'olvido-clave');
  console.log('Flujo completo OK');
} catch (e) {
  for (const pg of b.contexts().flatMap(c => c.pages())) await pg.screenshot({ path: OUT + '/fallo-' + Math.random().toString(36).slice(2, 6) + '.png' }).catch(() => {});
  problemas.push('FALLÓ el flujo: ' + e.message.split('\n').slice(0, 3).join(' | '));
}
console.log(problemas.length ? 'PROBLEMAS:\n' + problemas.join('\n') : 'Sin problemas');
await b.close();
process.exit(problemas.length ? 1 : 0);
