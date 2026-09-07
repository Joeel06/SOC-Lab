# 🛰️ Mini-SOC Casero

Laboratorio que simula un Security Operations Center (SOC) real: detección de amenazas de red, correlación de eventos, análisis asistido por IA y visualización propia.

En vez de depender únicamente de las herramientas ya integradas de Wazuh (su Dashboard basado en OpenSearch/Kibana), este proyecto añade una capa de visualización a medida construida en **React + Node.js**, con correlación de alertas, alertado por Telegram y análisis de logs con IA (Gemini).

> 🔒 **Nota sobre las IPs:** Las máquinas del laboratorio se referencian aquí como **Máquina X**, **Máquina Y** y **Máquina Z** en vez de sus IPs reales. La tabla de la sección 3 indica qué es cada una.

---

## 📑 Índice

1. [Visión general del proyecto](#1-visión-general-del-proyecto)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitectura del laboratorio](#3-arquitectura-del-laboratorio)
4. [Preparación de las máquinas virtuales](#4-preparación-de-las-máquinas-virtuales)
5. [Instalación de Wazuh (Manager + Indexer + Dashboard)](#5-instalación-de-wazuh-manager--indexer--dashboard)
6. [Despliegue de agentes Wazuh (Ubuntu y Kali)](#6-despliegue-de-agentes-wazuh-ubuntu-y-kali)
7. [Instalación e integración de Suricata (IDS)](#7-instalación-e-integración-de-suricata-ids)
8. [Verificación](#8-verificación-end-to-end-del-pipeline-de-detección)
9. [Panel propio](#9-panel-propio-mini-soc-dashboard-react--node)
10. [Funcionalidades del panel](#10-funcionalidades-del-panel)
11. [Pruebas de validación (fuerza bruta SSH)](#11-pruebas-de-validación-fuerza-bruta-ssh)



---

## 1. Visión general del proyecto

🎯 El objetivo es montar, de principio a fin, un mini-SOC funcional que:

- 🕵️ **Detecte** actividad maliciosa en la red (escaneos de puertos, fuerza bruta SSH, tráfico anómalo) mediante un IDS de red.
- 🧩 **Centralice y correlacione** esos eventos en un SIEM.
- 🔇 **Reduzca el ruido** agrupando alertas repetidas/idénticas en una sola entrada.
- 🤖 **Explique** cada alerta con ayuda de un modelo de IA, como lo haría un analista SOC junior.
- 📲 **Notifique** en tiempo real vía Telegram.
- 📊 **Visualice** todo en un panel propio, no en herramientas de terceros ya hechas — para demostrar capacidad de desarrollo full-stack aplicada a ciberseguridad.

Es un proyecto pensado explícitamente como pieza de portfolio: no solo demuestra el uso de herramientas de seguridad estándar de la industria, sino la capacidad de construir software a medida alrededor de ellas.


---

## 2. Stack tecnológico

| Capa | Herramienta | Función |
|---|---|---|
| 🛡️ SIEM | **Wazuh** (Manager + Indexer + Dashboard) | Recolección, correlación y almacenamiento de eventos de seguridad |
| 🚨 IDS de red | **Suricata** | Detección de intrusiones a nivel de red (escaneos, patrones de ataque conocidos) |
| ⚙️ Backend del panel | **Node.js + Express** | API propia que consulta Wazuh, correlaciona alertas, gestiona ajustes y notificaciones |
| ⚛️ Frontend del panel | **React + Vite** | Interfaz de usuario del SOC (dashboard, vista de agentes, ajustes) |
| 📩 Alertado | **Telegram Bot API** | Notificaciones en tiempo real de alertas |
| 🧠 Análisis de IA | **Google Gemini** (capa gratuita) | Análisis de logs de alertas con una persona de "analista SOC" |
| 💻 Virtualización | **VirtualBox** | VMs de Ubuntu Server, Ubuntu (objetivo) y Kali (atacante) |

---

## 3. Arquitectura del laboratorio

<img width="1024" height="559" alt="db72d1ea-6496-48e4-8a58-a765b1f639ab" src="https://github.com/user-attachments/assets/8f10e2a5-9ed2-4f4b-8626-903e19ae073f" />



| Etiqueta | Máquina | Rol |
|---|---|---|
| 🖥️ **Máquina X** | Ubuntu Server ("UbuntuServerSoc") | Aloja Wazuh Manager, Indexer y Dashboard — el cerebro del SIEM |
| 💀 **Máquina Y** | Kali Linux | Atacante: lanza escaneos (nmap), pings y pruebas de fuerza bruta SSH controladas |
| 🎯 **Máquina Z** | Ubuntu (objetivo) | Víctima con Suricata instalado, reenvía sus eventos al Wazuh Manager vía agente Wazuh |

**mini-soc-dashboard:** aplicación propia que consulta la API del Indexer (datos de alertas) y la API del Manager (roster de agentes) en la **Máquina X**, y corre en cualquier equipo con acceso de red al servidor Wazuh.

---

## 4. Preparación de las máquinas virtuales

1. Instala **VirtualBox** en el PC de sobremesa y en el portátil.
2. Crea tres VMs:
   - **Ubuntu Server** (sin entorno gráfico) en el PC de sobremesa → **Máquina X**, será el host de Wazuh. Recomendado: mínimo 4 GB RAM / 2 vCPU / 50 GB disco para Manager+Indexer+Dashboard juntos.
   - **Kali Linux** en el portátil → **Máquina Y**, será el atacante.
   - **Ubuntu Desktop/Server** en el portátil → **Máquina Z**, será el objetivo con Suricata.
3. Configura el adaptador de red de las tres VMs en modo **bridge** (o red interna/host-only si prefieres aislar el laboratorio de tu red doméstica), de forma que todas puedan verse entre sí por IP.
4. Asigna IP estática a la **Máquina X** (Ubuntu Server que alojará Wazuh).


## 5. Instalación de Wazuh (Manager + Indexer + Dashboard)

⚙️ Se utilizó el script de instalación "todo en uno" oficial de Wazuh, que despliega Manager, Indexer y Dashboard en la misma máquina (**Máquina X**) — adecuado para un laboratorio de este tamaño.

1. En la **Máquina X**, descarga el instalador oficial:
   ```bash
   curl -sO https://packages.wazuh.com/4.x/wazuh-install.sh
   curl -sO https://packages.wazuh.com/4.x/config.yml
   ```
   > Comprueba siempre la versión más reciente en la [documentación oficial de Wazuh](https://documentation.wazuh.com/current/installation-guide/index.html), ya que la URL del instalador cambia entre versiones.

2. Ejecuta el instalador todo-en-uno:
   ```bash
   sudo bash wazuh-install.sh -a
   ```
   Esto instala y configura automáticamente Wazuh Indexer, Wazuh Manager, Filebeat y Wazuh Dashboard, y genera certificados TLS autofirmados para las comunicaciones internas.

3. Al finalizar, el script muestra las credenciales generadas para el usuario `admin` del Dashboard — **guárdalas** 🔑, no vuelven a mostrarse en claro (puedes regenerarlas después si es necesario).

4. Verifica que los tres servicios están activos:
   ```bash
   sudo systemctl status wazuh-manager
   sudo systemctl status wazuh-indexer
   sudo systemctl status wazuh-dashboard
   ```

5. Accede al Dashboard desde un navegador en `https://<IP_MAQUINA_X>` y confirma el login con las credenciales de `admin`. ✅

---

## 6. Despliegue de agentes Wazuh (Ubuntu y Kali)

El agente Wazuh se instala en cada máquina que quieras monitorizar (**Máquina Y** y **Máquina Z**), no en el servidor.

En **cada** máquina agente:

1. Importa la clave GPG del repositorio de Wazuh e instala el paquete del agente:
   ```bash
   curl -o wazuh-agent.deb https://packages.wazuh.com/4.x/apt/pool/main/w/wazuh-agent/wazuh-agent_<VERSION>_amd64.deb
   sudo WAZUH_MANAGER='<IP_MAQUINA_X>' dpkg -i ./wazuh-agent.deb
   ```
   (Sustituye `<VERSION>` por la versión concreta indicada en la documentación oficial, y `<IP_MAQUINA_X>` por la IP real de tu Wazuh Manager.)

2. Habilita e inicia el agente:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable wazuh-agent
   sudo systemctl start wazuh-agent
   ```

3. Verifica que el agente se conectó correctamente:
   ```bash
   sudo systemctl status wazuh-agent
   ```

4. Desde el **Wazuh Dashboard** (Agentes → lista de agentes) o desde la API del Manager, confirma que el nuevo agente aparece como **Active** ✅.

> Repite estos pasos en la **Máquina Y** (Kali) y la **Máquina Z** (Ubuntu objetivo).

## 7. Instalación e integración de Suricata (IDS)
> Seguir pasos de la documentación [documentación oficial de Suricata](https://documentation.wazuh.com/current/proof-of-concept-guide/integrate-network-ids-suricata.html).


🚨 Suricata se instaló en la **Máquina Z** (la que recibe los ataques), para inspeccionar el tráfico de red que le llega y generar alertas que luego Wazuh recolecta.


## 8. Verificación end-to-end del pipeline de detección

🧪 Para confirmar que todo el pipeline (Suricata → agente → Manager → Indexer → Dashboard) funciona:

1. Desde la **Máquina Y** (Kali), lanza un escaneo de reconocimiento contra la **Máquina Z**:
   ```bash
   nmap -sS <IP_MAQUINA_Z>
   ping <IP_MAQUINA_Z>
   ```

2. En el Wazuh Dashboard (o consultando directamente el índice `wazuh-alerts-*` del Indexer), deberían aparecer alertas de tipo **ET SCAN** generadas por las reglas de Suricata, asociadas al agente de la **Máquina Z**.

Esto confirma que la cadena de detección de red está funcionando correctamente antes de construir el panel propio encima. ✅

---

## 9. Panel propio: mini-soc-dashboard (React + Node)

Con Wazuh y Suricata funcionando, se construyó una aplicación propia (`mini-soc-dashboard`) en vez de depender solo del Dashboard nativo de Wazuh, con dos partes:

- ⚙️ **Backend** (Node.js + Express, módulos ESM): expone una API propia que consulta Wazuh, normaliza y correlaciona las alertas, gestiona ajustes persistentes, y orquesta las notificaciones de Telegram y el análisis con IA.
- ⚛️ **Frontend** (React + Vite): interfaz visual del SOC — dashboard de alertas, vista por agente, y pantalla de ajustes.

### 9.1 Wazuh expone dos APIs distintas

Es importante distinguir las dos APIs de Wazuh que el backend consume:

| API | Puerto | Qué ofrece |
|---|---|---|
| 📇 **Wazuh Indexer** (OpenSearch) | `9200` | Datos de alertas propiamente dichos (`wazuh-alerts-*`) |
| 🗂️ **Wazuh Manager REST API** | `55000` | Roster real de agentes registrados (autenticación JWT vía `/security/user/authenticate`) |

Usar solo los datos de alertas para "contar agentes" es un error común: solo refleja qué agentes generaron alertas recientes, no el listado real y actualizado de agentes (activos, desconectados, eliminados). Por eso el backend consulta ambas APIs.

### 9.2 Variables de entorno del backend (`backend/.env`)

```bash

# Wazuh Indexer (alertas)
WAZUH_INDEXER_HOST=https://<IP_MAQUINA_X>:9200
WAZUH_INDEXER_USER=<usuario del indexer>
WAZUH_INDEXER_PASS=<password>
WAZUH_INDEXER_INSECURE=true   # certificados autofirmados

# Wazuh Manager API (roster de agentes)
WAZUH_API_HOST=https://<IP_MAQUINA_X>:55000
WAZUH_API_USER=wazuh-wui
WAZUH_API_PASS=<password de la API del manager>
WAZUH_API_INSECURE=true
```

> La contraseña de `wazuh-wui` para la API del Manager se puede consultar en la propia VM del servidor, normalmente en `/var/ossec/api/configuration/` o regenerarla con las herramientas de Wazuh; consulta la documentación oficial para el procedimiento exacto de tu versión.

Como los certificados del laboratorio son autofirmados, el backend usa un dispatcher HTTP personalizado (`undici`) con `rejectUnauthorized: false` cuando `*_INSECURE=true`, para poder conectar sin errores de TLS.

### 9.3 Instalación y arranque

```bash
# Backend
cd backend
npm install
npm run dev      

# Frontend
cd frontend
npm install
npm run dev
```

El frontend consume la API del backend (por defecto en `localhost` en el puerto configurado), que a su vez consulta Wazuh en la red del laboratorio.

---

## 10. Funcionalidades del panel

- 📊 **Dashboard principal:** resumen de alertas por severidad (crítica/alta/media/baja), número de agentes, última alerta recibida — todo con datos reales, sin datos de ejemplo.
- 🖥️ **Vista de agentes:** listado individual de cada agente real (Ubuntu, Kali) con su estado, IP, sistema operativo y contadores de alertas por severidad. Se auto-refresca cada 15 segundos, de forma que si añades o eliminas un agente en Wazuh, el panel se actualiza solo sin tocar código.
- 🔍 **Filtro de alertas por agente:** el desplegable de agentes del filtro se alimenta de la API real (`/api/agents`, sondeada cada 30s), nunca de una lista fija.
- 👻 **Exclusión del pseudo-agente del Manager:** Wazuh usa internamente el `id: "000"` para representar eventos propios del propio Manager (no un host monitorizado real); el panel lo excluye explícitamente de todos los conteos y listados de agentes para evitar un "agente fantasma".
- 🧩 **Correlación / deduplicación de alertas:** alertas idénticas repetidas en una ventana de tiempo configurable (mismo origen, agente, regla e IPs) se agrupan en una sola entrada con un contador `×N`, en vez de listar cada repetición por separado. Esto evita que, por ejemplo, 10 pings desde la misma IP generen 10 filas distintas.
- 🔎 **Detalle de alerta:** al hacer clic en cualquier alerta se abre un modal con el log completo (crudo y en JSON), información de la agrupación/correlación si aplica, y el análisis de IA asociado.
- 🧠 **Análisis con IA (Gemini, capa gratuita):** cada alerta puede analizarse bajo demanda (botón "Analizar con IA"), y las alertas de severidad **crítica** se analizan automáticamente. El prompt usa una persona de "analista SOC" que explica en español qué representa la alerta, su gravedad real y recomendaciones. Los resultados se cachean en memoria para no repetir llamadas innecesarias a la API.
  > ⚠️ Nota de privacidad: la capa gratuita de la API de Gemini puede usar los prompts enviados para entrenar sus modelos (a diferencia de la capa de pago) — algo a tener en cuenta si envías logs sensibles.
- 📲 **Notificaciones por Telegram:** bot configurable desde la propia pantalla de Ajustes (token, chat ID, severidad mínima a notificar). Los mensajes incluyen una explicación enriquecida de la alerta (heurística si no hay análisis de IA, o el resultado de la IA si está disponible), y el contador de repeticiones si la alerta está agrupada.
- ⚙️ **Ajustes de interfaz:** intervalo de refresco automático, severidad y fuente por defecto de los filtros, activar/desactivar correlación y su ventana de tiempo — todo persistido en `backend/data/settings.json` (con los valores sensibles como el token de Telegram o la API key de Gemini enmascarados al mostrarse en el frontend).
- 💾 **Persistencia de la vista:** la pestaña activa, filtros y modo de auto-refresco se guardan en `localStorage`, así que recargar la página (F5) no te devuelve al Dashboard si estabas en otra pantalla.

### 🧱 Arquitectura interna del backend (resumen)

- `normalize.js` — normaliza el formato de alertas de Wazuh a un modelo interno consistente, calcula severidad (`rule.level` 0–15 → crítica ≥12 / alta 8-11 / media 4-7 / baja 0-3).
- `correlate.js` — agrupa alertas por clave `[origen, agente, regla, IP origen, IP destino]` dentro de una ventana de tiempo deslizante.
- `gemini.js` — construye el prompt de analista SOC y llama a la API de Gemini.
- `telegram.js` — formatea y envía los mensajes de alerta.
- `alertWatcher.js` — proceso en segundo plano (cada ~20s) que combina correlación + análisis automático de críticas + envío a Telegram en un único ciclo, con deduplicación para no notificar dos veces la misma alerta.
- `wazuhManagerClient.js` — cliente de la API del Manager (autenticación JWT, roster de agentes).
- `settingsStore.js` — persistencia de ajustes en disco.

---

## 11. Pruebas de validación (fuerza bruta SSH)

🧪 Para validar el pipeline completo de extremo a extremo (detección → correlación → IA → Telegram) se ejecutó una prueba controlada de fuerza bruta SSH desde la **Máquina Y** (Kali) contra la **Máquina Z** (Ubuntu objetivo), usando **Hydra**:

```bash
hydra -l ubuntu -P /ruta/al/diccionario.txt -t 4 -f ssh://<IP_MAQUINA_Z>
```

- `-l` usuario objetivo
- `-P` diccionario de contraseñas
- `-t` número de tareas en paralelo
- `-f` detener al encontrar la primera credencial válida

> ✅ Prerrequisito: el servicio SSH debe estar instalado, activo y escuchando en la máquina objetivo (`sudo systemctl status ssh`, `sudo ss -tlnp | grep :22`), y el firewall debe permitir el tráfico desde la red del laboratorio.

Resultado esperado: Suricata/el propio log de autenticación SSH genera múltiples eventos de intento fallido desde la misma IP en poco tiempo → el motor de correlación los agrupa en una sola alerta `×N` → al ser de severidad alta/crítica se dispara el análisis automático de IA → se envía la notificación a Telegram con el resumen generado. 🎯


## 🏢 Cómo se desplegaría esto en un entorno empresarial 

Este laboratorio se instaló manualmente por ser un entorno de pocas máquinas, pero en producción:

- 🚨 **Suricata (NIDS)** no se instala en cada equipo: se coloca en pocos puntos estratégicos de la red (gateway, puerto espejo/SPAN de un switch, o un tap), viendo así el tráfico de todos los equipos que pasan por ese punto.
- 🛡️ **Wazuh (agente HIDS)** sí es por host, pero no se instala a mano uno por uno: se despliega vía paquetes (`.deb`/`.rpm`/`.msi`) con clave de enrolamiento pre-generada, usando GPO/Active Directory, Ansible/Puppet/Chef, SCCM/Intune, o integrándolo en la imagen "golden" de los equipos nuevos.
