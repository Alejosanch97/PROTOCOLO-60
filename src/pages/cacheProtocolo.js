/**
 * cacheProtocolo.js — Caché para el Protocolo 60
 * 
 * Guarda en localStorage los catálogos que casi nunca cambian:
 * - Perfil_Config
 * - Plan_Comidas
 * - Planes
 * - Rutina_Semana
 * - Rutina_Ejercicios
 * - Ref_Ajustes
 * - Ref_Sustituciones
 * - Alimentos
 * - Actividades
 * 
 * Los registros (Registro_*) SIEMPRE van a red para estar frescos.
 */

const API_URL =
  "https://script.google.com/macros/s/AKfycbzXAyHDhQodgu5mvasl-X6Nh5cHX5Rx700ZscoR6Aebp0Lg3iRTPH6VWGZPz86aDJpE/exec";

const PREFIJO = "p60_cache_";

// Lista de hojas que son catálogos (se cachean)
const HOJAS_CACHE = [
  "Perfil_Config",
  "Plan_Comidas",
  "Planes",
  "Rutina_Semana",
  "Rutina_Ejercicios",
  "Ref_Ajustes",
  "Ref_Sustituciones",
  "Alimentos",
  "Actividades",
];

// Lista de hojas de registro (SIEMPRE van a red)
const HOJAS_REGISTRO = [
  "Registro_Peso",
  "Registro_Gasto_Diario",
  "Registro_Plan_Cumplido",
  "Registro_Extra",
  "Registro_Actividad",
  "Registro_Agua",
  "Registro_Semanal",
];

const keyFor = (sheet) => PREFIJO + sheet;

const leerLocal = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Si tiene más de 1 hora, considerarlo expirado (los catálogos cambian rara vez)
    if (parsed.ts && Date.now() - parsed.ts > 3600000) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};

const guardarLocal = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // Ignorar si localStorage está lleno
  }
};

/**
 * Obtiene datos de una hoja con caché.
 * @param {string} sheet - Nombre de la hoja
 * @param {Function} onData - Callback(data, origen) donde origen es "cache" o "red"
 * @param {boolean} forzarRed - Si true, ignora caché
 */
export const fetchSheetCached = async (sheet, onData, forzarRed = false) => {
  const esCatalogo = HOJAS_CACHE.includes(sheet);
  const key = keyFor(sheet);

  // 1) Si es catálogo y NO se fuerza red, entrega caché instantáneo
  if (esCatalogo && !forzarRed) {
    const cached = leerLocal(key);
    if (cached) {
      onData(cached, "cache");
    }
  }

  // 2) Siempre va a red (para registros siempre, para catálogos si se fuerza o no hay caché)
  try {
    const res = await fetch(`${API_URL}?sheet=${encodeURIComponent(sheet)}`);
    const txt = await res.text();
    const data = JSON.parse(txt);
    const arr = Array.isArray(data) ? data : [];

    // Si es catálogo, guarda en caché
    if (esCatalogo) {
      guardarLocal(key, arr);
    }

    onData(arr, "red");
    return arr;
  } catch (error) {
    // Si falla red y tenemos caché, lo entregamos (aunque ya se entregó antes)
    const cached = leerLocal(key);
    if (cached) {
      onData(cached, "cache");
      return cached;
    }
    onData([], "error");
    return [];
  }
};

/**
 * Obtiene el resumen/déficit del día con caché de 30 segundos (se actualiza frecuentemente)
 */
export const fetchResumenCached = async (usuarioId, fecha, onData, forzarRed = false) => {
  const key = PREFIJO + "resumen_" + usuarioId + "_" + fecha;

  if (!forzarRed) {
    const cached = leerLocal(key);
    if (cached) {
      onData(cached, "cache");
    }
  }

  try {
    const res = await fetch(
      `${API_URL}?resumen=dia&usuario_id=${encodeURIComponent(usuarioId)}&fecha=${encodeURIComponent(fecha)}`
    );
    const txt = await res.text();
    const data = JSON.parse(txt);
    
    // Guarda en caché por 30 segundos (resumen cambia con cada registro)
    guardarLocal(key, data);
    onData(data, "red");
    return data;
  } catch {
    const cached = leerLocal(key);
    if (cached) {
      onData(cached, "cache");
      return cached;
    }
    onData({ status: "error" }, "error");
    return { status: "error" };
  }
};

/**
 * POST con caché: invalida automáticamente las hojas que cambian
 */
export const postActionCached = async (sheet, data, action = "create") => {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, sheet, data }),
    });
    const txt = await res.text();
    let result;
    try {
      result = JSON.parse(txt);
    } catch {
      result = { status: "success" };
    }

    // Invalida caché de la hoja modificada
    const key = keyFor(sheet);
    localStorage.removeItem(key);
    
    // También invalida resumen (cambian los datos)
    const keys = Object.keys(localStorage);
    keys.forEach((k) => {
      if (k.startsWith(PREFIJO + "resumen_")) {
        localStorage.removeItem(k);
      }
    });

    return result;
  } catch (error) {
    return { status: "error", message: error.message };
  }
};

/**
 * Invalida todo el caché
 */
export const invalidarTodo = () => {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(PREFIJO)) {
        localStorage.removeItem(k);
      }
    });
  } catch {}
};