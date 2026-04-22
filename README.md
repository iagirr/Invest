# Invest

Aplicacion local para seguimiento personal de fondos, ETFs y acciones.

El modelo de trabajo es deliberadamente pragmatico:

- el **pasado** se carga como una foto inicial coherente
- el **presente y futuro** se registran con aportaciones y retiradas reales
- el mercado se refresca manualmente para mantener el panel actualizado

La app esta pensada para uso personal, en local, con persistencia SQLite.

## Que resuelve

No intenta reconstruir un historico perfecto cuando no lo tienes.

En su lugar, te deja cargar por instrumento:

- fecha inicial exacta o aproximada
- capital inicial
- capital actual si sigue vivo, o capital de salida si ya esta cerrado
- rentabilidad total exacta o estimada
- estado activo o cerrado

Con eso calcula una base historica coherente. A partir de ahi, las aportaciones futuras ya se guardan como movimientos reales.

## Modelo funcional

### 1. Foto inicial

Cada fondo, ETF o accion se registra como una ficha de seguimiento inicial.

Campos principales:

- simbolo real
- nombre
- tipo: `fund`, `etf` o `stock`
- fecha inicial
- precision de fecha: `exact` o `estimated`
- capital inicial en EUR
- capital actual en EUR, o capital de salida si ya no lo tienes
- rentabilidad total en %
- precision de rentabilidad: `exact` o `estimated`
- estado: activo o cerrado

La app usa esos datos para estimar:

- base invertida implicita
- aportaciones historicas aproximadas
- rentabilidad consolidada desde la base inicial

### 2. Movimientos futuros reales

Una vez cerrada la foto inicial, los movimientos nuevos se registran como eventos reales:

- `contribution`
- `withdrawal`

Cada movimiento guarda:

- instrumento
- fecha
- importe EUR

Estos movimientos modifican la base acumulada del instrumento desde hoy en adelante.

### 3. Refresco de mercado

El mercado se actualiza manualmente.

En cada refresco:

- se descargan precios para activos vivos
- se actualiza el valor de mercado de esos instrumentos
- se recalcula el dashboard
- se guardan snapshots de evolucion

## Lo que muestra el dashboard

- valor total
- P/L total
- aportaciones futuras acumuladas
- activos vs cerrados
- metricas diaria, semanal, mensual, anual y desde base
- distribucion por instrumento
- evolucion de valor
- comparativa frente a benchmark
- tabla de instrumentos con:
  - estado
  - fecha de inicio
  - capital inicial
  - capital actual o de cierre
  - base acumulada
  - aportaciones futuras
  - P/L

## Stack

- Next.js
- React
- TypeScript
- SQLite con `better-sqlite3`
- Yahoo Finance para datos de mercado
- Recharts para graficas
- Tailwind CSS

## Arranque local

```bash
npm install
npm run dev
```

Abrir en navegador:

```text
http://localhost:3000
```

## Scripts utiles

### Refresco de mercado

```bash
npm run refresh
```

### Backup de la base local

```bash
npm run backup
```

## Persistencia local

La base principal se guarda en:

```text
data/portfolio.db
```

Tambien se generan:

- backups SQLite en `data/backups/`
- exportaciones JSON/CSV en `data/exports/`

## Exportaciones

Desde la interfaz:

- `Export JSON`
- `Export CSV`

Desde API:

- `GET /api/export?format=json`
- `GET /api/export?format=csv`

## Endpoints principales

- `POST /api/seed-position`
  - crea la foto inicial de un instrumento

- `POST /api/contributions`
  - registra aportaciones o retiradas futuras

- `POST /api/refresh-market`
  - refresca cotizaciones y snapshots

- `GET /api/search-assets?q=...`
  - busca fondos, ETFs y acciones reales

- `GET /api/dashboard`
  - devuelve el estado consolidado del panel

- `POST /api/settings`
  - actualiza benchmark

## Flujo recomendado de uso

1. Cargar la foto inicial de cada instrumento
2. Marcar cuales siguen activos y cuales ya estan cerrados
3. Refrescar mercado
4. Revisar el dashboard consolidado
5. A partir de ahi, registrar cada aportacion mensual nueva
6. Refrescar mercado cuando quieras actualizar valoraciones

## Estado actual

El proyecto ya soporta:

- carga inicial flexible
- instrumentos activos y cerrados
- fondos, ETFs y acciones reales
- aportaciones futuras reales
- benchmark configurable
- backup y exportacion

## Limitaciones actuales

- la reconstruccion del pasado es coherente, no forense
- la precision depende de la calidad de la foto inicial que introduzcas
- no hay aun edicion ni borrado de instrumentos o movimientos
- no hay autenticacion ni multiusuario

## Siguientes mejoras razonables

- editar o eliminar movimientos
- vista detalle por instrumento
- timeline de aportaciones
- importacion desde CSV o JSON
- cierre parcial de posiciones
