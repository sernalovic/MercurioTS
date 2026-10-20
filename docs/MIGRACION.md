# Migración del sistema anterior a Mercurio

La herramienta `tools/Mercurio.Migracion` trabaja en tres pasos independientes:

| Paso | Qué hace | Toca el sistema anterior | Toca la base de datos nueva |
|---|---|---|---|
| `exportar` | Lee todo del sistema anterior y lo guarda en una carpeta, tal cual llega | Solo lectura (GET) | No |
| `comparar` | Recalcula con Mercurio lo que el sistema anterior tenía guardado y escribe las diferencias | No | No |
| `importar` | Vuelca la carpeta en una base de datos Mercurio vacía, con los mismos ids | No | Sí |

La exportación se hace una vez. Comparar e importar se pueden repetir sobre la misma carpeta tantas veces como haga falta.

## 1. Exportar
Hace falta un usuario **administrador** del sistema anterior. La contraseña se pide al ejecutar y no se muestra ni se guarda.

```bash
dotnet run --project tools/Mercurio.Migracion -- exportar --origen https://orion2.azurewebsites.net/ --usuario TU_USUARIO --desde 2019 --carpeta exportacion-sistema-anterior
```

- `--desde` es el primer año de calendarios que se exporta. Si el sistema empezó antes de 2019, pon ese año.
- Se recorren todos los meses y centros, así que puede tardar varios minutos.
- La carpeta contiene datos personales y laborales: guárdala en un sitio seguro y no la subas a ningún repositorio.

## 2. Comparar
```bash
dotnet run --project tools/Mercurio.Migracion -- comparar --carpeta exportacion-sistema-anterior
```
Genera `comparacion.md` (resumen y ejemplos por campo) y `comparacion.csv` (todas las diferencias). Se revisan cuatro cosas:
- **Gráficos:** horas, dietas y errores de cada gráfico recalculados con el convenio de su año.
- **Servicios diarios** (trabajado y virtual): horas, dietas, paquetería y plus por menor descanso.
- **Resúmenes mensuales:** todos los contadores e importes, recalculados a partir de los días tal como estaban guardados.

Cada diferencia significa una de estas tres cosas:
1. una regla de Mercurio que no reproduce bien la del original (hay que corregirla);
2. un dato que el original guardó así por una edición manual o porque no se recalculó;
3. un comportamiento dudoso del original que hay que decidir si se mantiene.

## 3. Importar
Crea antes una base de datos **vacía** en el PostgreSQL de destino. Después:
```bash
dotnet run --project tools/Mercurio.Migracion -- importar --carpeta exportacion-sistema-anterior --conexion "Host=localhost;Port=5432;Database=mercurio;Username=postgres;Password=..."
```
- Aplica las migraciones, inserta todo con los mismos ids que en el sistema anterior y ajusta los contadores de ids.
- Los registros duplicados que violarían las reglas de unicidad (dos calendarios del mismo conductor y mes, por ejemplo) se descartan y se anotan en `avisos-importacion.txt`.
- **Usuarios:** las contraseñas del sistema anterior no se pueden recuperar. Los usuarios se crean con sus datos y permisos, pero sin contraseña. Cada uno pone la suya con "¿Has olvidado la contraseña?" en el portal, que necesita el SMTP configurado. Mientras tanto, un superusuario de Mercurio puede ayudarles.
- Se niega a escribir en una base de datos que ya tenga datos, salvo con `--forzar`.

## 4. Poner contraseña a un usuario importado
Para poder entrar sin depender del correo, un administrador puede fijar la contraseña directamente:
```bash
dotnet run --project tools/Mercurio.Migracion -- clave --conexion "Host=localhost;Port=5432;Database=mercurio;Username=postgres;Password=..." --usuario EMAIL_O_USUARIO
```
La contraseña se pide sin mostrarla y debe tener al menos 8 caracteres.

## Resultado con los datos reales (20/10/2026)
- Se importaron 303 conductores, 6 convenios, 32 líneas, 9.511 gráficos, 7.271 calendarios (221.222 días), 43 reclamaciones, 10 nóminas y 65 usuarios en la base de datos local `mercurio`.
- 56 avisos:
  - 31 calendarios de dos conductores que ya no existen en el sistema anterior (ids 7 y 1847);
  - 25 calendarios duplicados del mismo conductor y mes, de los que se conserva el primero.
- Verificado comparando totales de la exportación y de la base de datos (recuentos, horas acumuladas, cenas, números de gráfico, importes de resúmenes y horas de gráficos): coinciden exactamente.
- El análisis de diferencias de cálculo está en [analisis-sistema-anterior/COMPARACION-DATOS-REALES.md](analisis-sistema-anterior/COMPARACION-DATOS-REALES.md).

## Comprobado
- La exportación, la comparación y la importación se han probado usando un servidor Mercurio local como origen: misma API y mismas rutas. Los datos importados coinciden byte a byte con el origen (huella MD5 por tabla).
- La lectura del formato propio del sistema anterior tiene pruebas automáticas (`tests/Mercurio.Domain.Tests/MigracionTests.cs`): horas vacías como `""` o `TimeSpan.MaxValue`, fechas `yyyy-MM-dd` y enumeraciones por nombre con tildes o guiones bajos.
- **Aún no se ha ejecutado contra el el sistema anterior real.** Pueden aparecer diferencias de formato que solo se verán con sus datos.
