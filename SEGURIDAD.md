# Seguridad de Genefit

Genefit guarda datos personales de cada cliente: entrenos, peso, medidas, fotos y mensajes.
Esta guía explica cómo están protegidos y los pasos que hay que hacer **una vez** en Firebase.

## Quién puede ver qué

| Dato | El cliente | Su coach | Otros clientes | Alguien sin cuenta |
|---|---|---|---|---|
| Entrenos, récords, rutinas asignadas, chat | ✅ | ✅ | ❌ | ❌ |
| Medidas y fotos **compartidas** | ✅ | ✅ | ❌ | ❌ |
| Medidas, fotos y rutinas **privadas** | ✅ | ❌ | ❌ | ❌ |
| Sesiones compradas y usadas | ✅ (las compra y descuenta) | solo ver | ❌ | ❌ |
| Acceso (suspendido o eliminado) | solo ver | ✅ | ❌ | ❌ |
| Plantillas de rutinas del coach | ❌ | ✅ | ❌ | ❌ |
| Comprobantes de pago SINPE | ✅ (los adjunta) | ✅ (los revisa) | ❌ | ❌ |
| Zonas de dolor que reporta | ✅ | ✅ | ❌ | ❌ |
| Su nombre y número en un reto (solo si se une) | ✅ | ✅ | ✅ | ❌ |
| Número SINPE y precio por sesión | ✅ | ✅ | ✅ | ❌ |

Además:
- Nadie puede hacerse pasar por el coach ni escribir mensajes a nombre de otra persona.
- Los mensajes no se pueden editar después de enviados.
- El cliente registra él mismo sus compras de sesiones y cada sesión que usa; el coach no las puede cambiar, solo verlas. Un cliente no puede marcar su propio comprobante como revisado.
- En los retos nadie puede inscribir a otra persona ni publicar más que su nombre y su número.
- Un cliente eliminado ya no puede escribir en su ficha.
- Las fotos solo se aceptan como imagen guardada dentro de Genefit (no enlaces externos).
- Al tocar **Salir** se borra del teléfono la copia de los datos y el entreno en curso,
  para que la siguiente persona que use ese aparato no vea nada.
- Las cuentas nuevas necesitan una clave de al menos 8 caracteres que no sea solo números.

Todo esto está escrito en [`firestore.rules`](firestore.rules) y probado en [`pruebas/`](pruebas/).

## Pasos en la consola de Firebase (hacer una vez)

### 1. Publicar las reglas (lo más importante)
1. Entra a <https://console.firebase.google.com> → proyecto **genefit-1a52a**.
2. **Firestore Database → Reglas**.
3. Borra lo que haya, pega todo el contenido de [`firestore.rules`](firestore.rules) y toca **Publicar**.

### 2. Endurecer el inicio de sesión
En **Authentication → Configuración**:
- **Política de contraseñas**: mínimo 8 caracteres.
- **Protección contra la enumeración de correos**: activada (evita que alguien averigüe qué correos tienen cuenta).
- **Dominios autorizados**: deja solo `genefit-cr.github.io` y `localhost`. Borra cualquier otro.

### 3. Limitar la clave de la web
La `apiKey` que está en `index.html` es pública por diseño en todas las apps de Firebase:
lo que protege los datos son las reglas. Aun así, conviene limitarla:
1. <https://console.cloud.google.com/apis/credentials> → proyecto **genefit-1a52a**.
2. Abre la clave **Browser key** → **Restricciones de aplicación → Sitios web**.
3. Agrega `https://genefit-cr.github.io/*` y guarda.

### 4. Alerta de gastos
En **Configuración del proyecto → Uso y facturación**, crea una alerta de presupuesto para enterarte
si alguien intenta abusar del servicio.

## Correr las pruebas
Con Node 18+ y Java 11+ instalados:

```bash
bash pruebas/correr.sh
```

Usa los emuladores de Firebase en tu computadora. **No toca la base de datos real.**
