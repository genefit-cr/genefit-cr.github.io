import { initializeTestEnvironment, assertSucceeds as ok, assertFails as no } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

const env = await initializeTestEnvironment({
  projectId: 'genefit-test',
  firestore: { rules: readFileSync(process.argv[2], 'utf8'), host: '127.0.0.1', port: 8080 },
});
const db = u => env.authenticatedContext(u).firestore();
const anon = env.unauthenticatedContext().firestore();
const coach = db('coach'), bob = db('bob'), eve = db('eve');
let n = 0, fails = 0;
async function t(name, p) { n++; try { await p; } catch (e) { fails++; console.log('FALLA:', name, '-', e.message.split('\n')[0]); } }

const foto = 'data:image/jpeg;base64,AAAA';
const prof = { alias: 'Bob', alta: 1, compartir: false, v: 2 };

// Coach
await t('anónimo no lee coach', no(anon.doc('config/coach').get()));
await t('coach se reclama', ok(coach.doc('config/coach').set({ uid: 'coach', nombre: 'Gene' })));
await t('eve no roba coach', no(eve.doc('config/coach').set({ uid: 'eve', nombre: 'x' })));
await t('cualquiera lee config/coach', ok(bob.doc('config/coach').get()));

// Perfiles
await t('bob crea perfil', ok(bob.doc('clientes/bob').set(prof)));
await t('bob no crea perfil de otro', no(bob.doc('clientes/eve').set(prof)));
await t('eve crea su perfil', ok(eve.doc('clientes/eve').set({ ...prof, alias: 'Eve' })));
await t('eve NO lee a bob', no(eve.doc('clientes/bob').get()));
await t('eve NO lista clientes', no(eve.collection('clientes').get()));
await t('anónimo NO lee a bob', no(anon.doc('clientes/bob').get()));
await t('coach lee a bob', ok(coach.doc('clientes/bob').get()));
await t('coach lista clientes', ok(coach.collection('clientes').get()));
await t('bob no mete campos raros', no(bob.doc('clientes/bob').update({ esCoach: true })));
await env.withSecurityRulesDisabled(c => c.firestore().doc('clientes/bob').update({ campoViejo: 1 }));
await t('ficha con campo antiguo sigue guardando', ok(bob.doc('clientes/bob').update({ ultimo: 1 })));
await t('bob elige azul', ok(bob.doc('clientes/bob').update({ sexo: 'm' })));
await t('bob guarda tendencias', ok(bob.doc('clientes/bob').update({ tend: { ses30: 3, prs30: 1, estanc: [], sube: [] } })));
await t('coach NO cambia tendencias', no(coach.doc('clientes/bob').update({ tend: {} })));
await t('sexo inválido', no(bob.doc('clientes/bob').update({ sexo: 'x' })));
await t('alias muy largo', no(bob.doc('clientes/bob').update({ alias: 'x'.repeat(41) })));

// Entrenos
await t('bob guarda entreno', ok(bob.doc('clientes/bob/historial/w1').set({ titulo: 'Pierna', rutina: 'Pierna', fecha: 2, min: 50, series: 10, reps: 100, volumen: 5000, ejercicios: [], prs: [], nota: '', detalle: [] })));
await t('bob guarda récord', ok(bob.doc('clientes/bob/records/sentadilla').set({ nombre: 'Sentadilla', kg: 100, reps: 5, fecha: 2 })));
await t('bob actualiza resumen', ok(bob.doc('clientes/bob').update({ ultimo: 2, ultTitulo: 'Pierna', ultMin: 50, ultPRs: 1, ultVol: 5000 })));
await t('eve NO lee entrenos de bob', no(eve.collection('clientes/bob/historial').get()));
await t('eve NO escribe en bob', no(eve.doc('clientes/bob/historial/w2').set({ titulo: 'x' })));
await t('coach lee entrenos', ok(coach.collection('clientes/bob/historial').orderBy('fecha', 'desc').limit(20).get()));

// Privado
await t('bob guarda medida privada', ok(bob.doc('privado/bob/medidas/m1').set({ fecha: 1, peso: 80 })));
await t('bob guarda foto privada', ok(bob.doc('privado/bob/fotos/f1').set({ img: foto, pose: 'Frente', fecha: 1 })));
await t('bob guarda rutina propia', ok(bob.doc('privado/bob/rutinas/r1').set({ nombre: 'A', ejercicios: [], orden: 1 })));
await t('COACH NO lee privado de bob', no(coach.collection('privado/bob/medidas').get()));
await t('eve NO lee privado de bob', no(eve.doc('privado/bob/fotos/f1').get()));

// Compartido
await t('bob comparte foto', ok(bob.doc('clientes/bob/fotos/f1').set({ img: foto, pose: 'Frente', fecha: 1 })));
await t('foto con enlace externo bloqueada', no(bob.doc('clientes/bob/fotos/f2').set({ img: 'https://malo.com/x.jpg', pose: 'Frente', fecha: 1 })));
await t('bob comparte medida', ok(bob.doc('clientes/bob/medidas/m1').set({ fecha: 1, peso: 80 })));
await t('coach ve lo compartido', ok(coach.collection('clientes/bob/fotos').get()));
await t('bob deja de compartir', ok(bob.doc('clientes/bob/medidas/m1').delete()));

// Rutinas
await t('coach crea plantilla', ok(coach.doc('plantillas/p1').set({ nombre: 'Empuje', ejercicios: [], orden: 1 })));
await t('bob NO ve plantillas', no(bob.collection('plantillas').get()));
await t('coach asigna', ok(coach.doc('clientes/bob/asignadas/p1').set({ nombre: 'Empuje', ejercicios: [], dias: [], nota: '', fecha: 1, plantilla: 'p1' })));
await t('bob lee asignadas', ok(bob.collection('clientes/bob/asignadas').get()));
await t('bob NO se asigna', no(bob.doc('clientes/bob/asignadas/p2').set({ nombre: 'x' })));

// Chat
await t('bob escribe al coach', ok(bob.doc('clientes/bob/mensajes/m1').set({ de: 'bob', texto: 'hola', fecha: 1 })));
await t('bob NO suplanta al coach', no(bob.doc('clientes/bob/mensajes/m2').set({ de: 'coach', texto: 'pagaste', fecha: 1 })));
await t('coach responde', ok(coach.doc('clientes/bob/mensajes/m3').set({ de: 'coach', texto: 'hola Bob', fecha: 2 })));
await t('coach marca último msg', ok(coach.doc('clientes/bob').update({ ultMsg: { de: 'coach', texto: 'hola Bob', fecha: 2 } })));
await t('coach NO cambia otros campos', no(coach.doc('clientes/bob').update({ alias: 'Roberto' })));
await t('bob sigue guardando con msg del coach', ok(bob.doc('clientes/bob').update({ ultimo: 3 })));
await t('bob NO edita mensajes', no(bob.doc('clientes/bob/mensajes/m3').update({ texto: 'otro' })));
await t('eve NO lee chat de bob', no(eve.collection('clientes/bob/mensajes').get()));
await t('mensaje gigante', no(bob.doc('clientes/bob/mensajes/m4').set({ de: 'bob', texto: 'x'.repeat(501), fecha: 1 })));

// Acceso y pagos
await t('bob NO se pone al día', no(bob.doc('acceso/bob').set({ pagoHasta: 9e12 })));
await t('coach registra pago', ok(coach.doc('acceso/bob').set({ pagoHasta: 9e12, ultPago: 1, bloqueado: false, eliminado: false, alias: 'Bob' }, { merge: true })));
await t('bob lee su acceso', ok(bob.doc('acceso/bob').get()));
await t('eve NO lee acceso de bob', no(eve.doc('acceso/bob').get()));
await t('coach lista accesos', ok(coach.collection('acceso').get()));

// Traducciones y rutas desconocidas
await t('bob lee trad', ok(bob.doc('trad/x').get()));
await t('bob NO escribe trad', no(bob.doc('trad/x').set({ pasos: [] })));
await t('ruta desconocida bloqueada', no(bob.doc('otra/cosa').set({ a: 1 })));

// SINPE
await t('coach guarda SINPE', ok(coach.doc('config/coach').set({ sinpe: '88881234', monto: 25000, titular: 'Gene' }, { merge: true })));
await t('coach activa ntfy', ok(coach.doc('config/coach').set({ ntfy: 'genefit-abc123' }, { merge: true })));
await t('bob NO cambia ntfy', no(bob.doc('config/coach').set({ ntfy: 'otro' }, { merge: true })));
await t('bob NO cambia SINPE', no(bob.doc('config/coach').set({ sinpe: '80000000' }, { merge: true })));
await t('bob sube comprobante', ok(bob.doc('clientes/bob/comprobantes/c1').set({ img: foto, ref: '123', monto: 25000, fecha: 1, estado: 'pendiente' })));
await t('bob NO se aprueba solo', no(bob.doc('clientes/bob/comprobantes/c2').set({ img: foto, ref: '', monto: 25000, fecha: 1, estado: 'aprobado' })));
await t('bob NO edita comprobante', no(bob.doc('clientes/bob/comprobantes/c1').update({ estado: 'aprobado' })));
await t('bob marca comprobante pendiente', ok(bob.doc('clientes/bob').update({ compPend: { id: 'c1', fecha: 1, monto: 25000 } })));
await t('eve NO ve comprobante de bob', no(eve.doc('clientes/bob/comprobantes/c1').get()));
await t('coach aprueba', ok(coach.doc('clientes/bob/comprobantes/c1').update({ estado: 'aprobado', revisado: 2 })));
await t('coach limpia pendiente', ok(coach.doc('clientes/bob').update({ compPend: null })));
// Dolor
await t('bob reporta dolor', ok(bob.doc('clientes/bob').update({ dolor: { z: { hombros: 2 }, nota: '', fecha: 1 } })));
// Retos
await t('coach crea reto', ok(coach.doc('retos/r1').set({ titulo: 'Nov', tipo: 'entrenos', desde: 0, hasta: 9e12, creado: 1 })));
await t('bob NO crea retos', no(bob.doc('retos/r2').set({ titulo: 'x' })));
await t('bob se une', ok(bob.doc('retos/r1/participantes/bob').set({ alias: 'Bob', valor: 3, act: 1 })));
await t('bob NO inscribe a otro', no(bob.doc('retos/r1/participantes/eve').set({ alias: 'Eve', valor: 99, act: 1 })));
await t('bob NO mete datos extra', no(bob.doc('retos/r1/participantes/bob').set({ alias: 'Bob', valor: 3, act: 1, peso: 80 })));
await t('eve ve el ranking', ok(eve.collection('retos/r1/participantes').get()));
await t('NO se une a reto inexistente', no(bob.doc('retos/nada/participantes/bob').set({ alias: 'Bob', valor: 1, act: 1 })));
await t('anónimo NO ve retos', no(anon.collection('retos').get()));

// Eliminar cliente (como lo hace la app)
await t('coach marca eliminado', ok(coach.doc('acceso/eve').set({ bloqueado: true, eliminado: true, alias: 'Eve', eliminadoEl: 1 }, { merge: true })));
await t('coach borra perfil', ok(coach.doc('clientes/eve').delete()));
await t('eve eliminada NO se recrea', no(eve.doc('clientes/eve').set({ ...prof, alias: 'Eve' })));
await t('eve eliminada NO escribe entrenos', no(eve.doc('clientes/eve/historial/w1').set({ titulo: 'x' })));
await t('eve conserva su privado', ok(eve.doc('privado/eve/medidas/m1').set({ fecha: 1 })));

console.log(`${n - fails}/${n} pruebas pasaron`);
await env.cleanup();
process.exit(fails ? 1 : 0);
