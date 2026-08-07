import React, { useState, useEffect, useCallback, useMemo } from "react";
import "../Styles/plan.css";
import { fetchSheetCached } from "./cacheProtocolo";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzXAyHDhQodgu5mvasl-X6Nh5cHX5Rx700ZscoR6Aebp0Lg3iRTPH6VWGZPz86aDJpE/exec";

const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v) => {
  const n = Number(clean(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};
const toDate = (v) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// Revierte valores que Sheets convirtió en fecha (ej "10-15" -> "2026-10-15T...")
// y los devuelve como el rango original "10-15".
const fixReps = (v) => {
  const s = clean(v);
  if (!s) return "";
  // Si viene como fecha ISO o Date parseable con pinta de fecha
  const isoMatch = s.match(/^\d{4}-(\d{2})-(\d{2})T/);
  if (isoMatch) {
    // mes-día -> "mes-día" sin ceros a la izquierda
    return `${Number(isoMatch[1])}-${Number(isoMatch[2])}`;
  }
  return s;
};

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_JS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Ejercicios que NO tienen GIF (rutina_id + orden). Ej: "25" = rutina 2, orden 5.
const SIN_VIDEO = new Set(["25"]);

/**
 * Arma la ruta del GIF de un ejercicio con la convención {rutina_id}{orden}.gif.
 * Ej: rutina_id=1, orden=1 -> /ejercicios/11.gif
 * Devuelve null si el ejercicio no tiene video.
 */
const videoDeEjercicio = (e) => {
  const rid = (e.rutina_id || "").toString().trim();
  const orden = (e.orden || "").toString().trim();
  if (!rid || !orden) return null;
  const clave = `${rid}${orden}`;
  if (SIN_VIDEO.has(clave)) return null;
  const ruta = `/ejercicios/${clave}.gif`;
  return { img: ruta, original: ruta };
};

export const PlanSection = ({ user }) => {
  const [vista, setVista] = useState("menu"); // menu | rutina
  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [comidas, setComidas] = useState([]);
  const [rutinaSemana, setRutinaSemana] = useState([]);
  const [rutinas, setRutinas] = useState([]);
  const [rutinaEj, setRutinaEj] = useState([]);

  const hoyDia = DIAS_JS[new Date().getDay()];
  const [semana, setSemana] = useState(1);
  const [dia, setDia] = useState(hoyDia === "Domingo" ? "Domingo" : hoyDia);
  const [videoEj, setVideoEj] = useState(null); // ejercicio cuyo video se está viendo
  const [videoError, setVideoError] = useState(false);

  const cargar = useCallback(async (forzarRed = false) => {
    setLoading(true);

    let configData, planesData, comidasData, rutinaSemanaData, rutinasData, rutinaEjData;

    await Promise.all([
      new Promise((resolve) => {
        fetchSheetCached("Perfil_Config", (data, origen) => {
          configData = data;
          console.log("Plan - Perfil_Config desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Planes", (data, origen) => {
          planesData = data;
          console.log("Plan - Planes desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Plan_Comidas", (data, origen) => {
          comidasData = data;
          console.log("Plan - Plan_Comidas desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Rutina_Semana", (data, origen) => {
          rutinaSemanaData = data;
          console.log("Plan - Rutina_Semana desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Rutinas", (data, origen) => {
          rutinasData = data;
          console.log("Plan - Rutinas desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Rutina_Ejercicios", (data, origen) => {
          rutinaEjData = data;
          console.log("Plan - Rutina_Ejercicios desde:", origen);
          resolve();
        }, forzarRed);
      }),
    ]);

    setConfig(configData?.[0] || null);
    setPlanes(planesData || []);
    setComidas(comidasData || []);
    setRutinaSemana(rutinaSemanaData || []);
    setRutinas(rutinasData || []);
    setRutinaEj(rutinaEjData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Semana actual del protocolo para resaltar
  const semanaActual = useMemo(() => {
    const inicio = toDate(config?.fecha_inicio);
    if (!inicio) return 1;
    const diff = Math.floor((new Date() - inicio) / (1000 * 60 * 60 * 24));
    return Math.min(12, Math.max(1, Math.floor(diff / 7) + 1));
  }, [config]);

  useEffect(() => {
    setSemana(semanaActual);
  }, [semanaActual]);

  const planSemana = useMemo(
    () => planes.find((p) => clean(p.semana || p.id) === String(semana)) || planes[semana - 1] || null,
    [planes, semana]
  );

  const comidasDia = useMemo(
    () =>
      comidas
        .filter((c) => clean(c.semana) === String(semana) && clean(c.dia_semana) === dia)
        .sort((a, b) => num(a.id) - num(b.id)),
    [comidas, semana, dia]
  );

  const entrenoDia = useMemo(
    () => rutinaSemana.find((r) => clean(r.dia_semana) === dia) || null,
    [rutinaSemana, dia]
  );
  const rutinaInfo = useMemo(
    () => rutinas.find((r) => clean(r.id) === clean(entrenoDia?.rutina_id)) || null,
    [rutinas, entrenoDia]
  );
  const ejercicios = useMemo(() => {
    if (!entrenoDia || !clean(entrenoDia.rutina_id)) return [];
    return rutinaEj
      .filter((e) => clean(e.rutina_id) === clean(entrenoDia.rutina_id))
      .sort((a, b) => num(a.orden) - num(b.orden));
  }, [entrenoDia, rutinaEj]);

  if (loading) return <div className="plan-loader">Cargando plan…</div>;

  return (
    <div className="plan-wrap">
      <div className="plan-head">
        <h2 className="plan-title">Mi plan</h2>
        {planSemana && (
          <span className="plan-block">
            {clean(planSemana.bloque)} · {num(planSemana.kcal_objetivo_dia)} kcal
          </span>
        )}
      </div>

      {/* Toggle menú / rutina */}
      <div className="plan-toggle">
        <button className={vista === "menu" ? "on" : ""} onClick={() => setVista("menu")}>🍽 Menú</button>
        <button className={vista === "rutina" ? "on" : ""} onClick={() => setVista("rutina")}>🏋 Rutina</button>
      </div>

      {/* Selector de semana */}
      <div className="plan-weeks">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
          <button
            key={w}
            className={`plan-week ${semana === w ? "on" : ""} ${w === semanaActual ? "now" : ""}`}
            onClick={() => setSemana(w)}
          >
            {w}
          </button>
        ))}
      </div>

      {/* Foco de la semana */}
      {planSemana && clean(planSemana.foco_semana) && (
        <div className="plan-foco">
          <span>SEMANA {semana}</span>
          {clean(planSemana.foco_semana)}
          {clean(planSemana.tipo_semana) && <b className="plan-deload">{clean(planSemana.tipo_semana)}</b>}
        </div>
      )}

      {/* Selector de día */}
      <div className="plan-days">
        {DIAS.map((d) => (
          <button key={d} className={`plan-day ${dia === d ? "on" : ""}`} onClick={() => setDia(d)}>
            {d.slice(0, 3)}
          </button>
        ))}
      </div>

      {/* ---------- MENÚ ---------- */}
      {vista === "menu" && (
        <div className="plan-content">
          {comidasDia.length === 0 ? (
            <p className="plan-empty">No hay comidas para este día.</p>
          ) : (
            comidasDia.map((c) => (
              <div className="plan-meal" key={c.id}>
                <div className="plan-meal-head">
                  <span className="plan-meal-when">{clean(c.momento)}</span>
                  <span className="plan-meal-kcal">{num(c.kcal_aprox)} kcal</span>
                </div>
                <p className="plan-meal-desc">{clean(c.descripcion)}</p>
                {clean(c.proteina_g_aprox) && (
                  <span className="plan-meal-prot">Proteína {clean(c.proteina_g_aprox)} g</span>
                )}
              </div>
            ))
          )}
          {planSemana && (
            <div className="plan-macros">
              <div><span>KCAL</span><b>{num(planSemana.kcal_objetivo_dia)}</b></div>
              <div><span>PROT</span><b>{num(planSemana.proteina_objetivo_g)}g</b></div>
              <div><span>CARB</span><b>{num(planSemana.carbos_objetivo_g)}g</b></div>
              <div><span>GRASA</span><b>{num(planSemana.grasa_objetivo_g)}g</b></div>
            </div>
          )}
        </div>
      )}

      {/* ---------- RUTINA ---------- */}
      {vista === "rutina" && (
        <div className="plan-content">
          {!entrenoDia ? (
            <p className="plan-empty">No hay información de entrenamiento para este día.</p>
          ) : (
            <>
              <div className="plan-session">
                <h3>{clean(entrenoDia.sesion)}</h3>
                {clean(entrenoDia.cardio_incluido) && clean(entrenoDia.cardio_incluido) !== "—" && (
                  <p className="plan-cardio">🏃 {clean(entrenoDia.cardio_incluido)}</p>
                )}
                {rutinaInfo && clean(rutinaInfo.movilidad) && (
                  <p className="plan-mov"><b>Movilidad:</b> {clean(rutinaInfo.movilidad)}</p>
                )}
              </div>

              {ejercicios.length > 0 ? (
                <div className="plan-ex-table">
                  <div className="plan-ex-head">
                    <span>Ejercicio</span>
                    <span>Series×Reps</span>
                    <span>Rest</span>
                  </div>
                  {ejercicios.map((e) => (
                    <div className="plan-ex-row" key={e.id}>
                      <span className="plan-ex-name">
                        {clean(e.nombre_ejercicio)}
                        {clean(e.si_ocupado) && clean(e.si_ocupado) !== "—" && (
                          <em>si ocupado: {clean(e.si_ocupado)}</em>
                        )}
                        {videoDeEjercicio(e) && (
                          <button
                            className="plan-ex-video"
                            onClick={() => { setVideoError(false); setVideoEj(e); }}
                          >
                            ▶ Ver video
                          </button>
                        )}
                      </span>
                      <span className="plan-ex-sr">{clean(e.series)} × {fixReps(e.repeticiones)}</span>
                      <span className="plan-ex-rest">{clean(e.descanso)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="plan-rest">Día de descanso o cardio libre. Recupera bien.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* MODAL DE VIDEO */}
      {videoEj && (() => {
        const v = videoDeEjercicio(videoEj);
        return (
          <div className="plan-video-overlay" onClick={() => setVideoEj(null)}>
            <div className="plan-video-modal" onClick={(ev) => ev.stopPropagation()}>
              <div className="plan-video-head">
                <span>{clean(videoEj.nombre_ejercicio)}</span>
                <button className="plan-video-close" onClick={() => setVideoEj(null)}>✕</button>
              </div>
              <div className="plan-video-body">
                {!videoError ? (
                  <img
                    src={v.img}
                    alt={clean(videoEj.nombre_ejercicio)}
                    className="plan-video-gif"
                    onError={() => setVideoError(true)}
                  />
                ) : (
                  <div className="plan-video-fallback">
                    <p>No se pudo cargar el video de este ejercicio.</p>
                    <a href={v.original} target="_blank" rel="noopener noreferrer" className="plan-video-link">
                      Abrir en otra pestaña
                    </a>
                  </div>
                )}
              </div>
              <div className="plan-video-foot">
                <span>{clean(videoEj.series)} × {fixReps(videoEj.repeticiones)} · descanso {clean(videoEj.descanso)}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};