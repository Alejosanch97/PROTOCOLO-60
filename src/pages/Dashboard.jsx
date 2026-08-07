import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/dashboard.css";
import { RegistrarSection } from "./RegistrarSection";
import { ProgresoSection } from "./ProgresoSection";
import { PlanSection } from "./PlanSection";
import { fetchSheetCached, fetchResumenCached, invalidarTodo } from "./cacheProtocolo";

const Placeholder = ({ titulo, nota }) => (
  <div className="p60-placeholder">
    <span className="p60-ph-icon">◑</span>
    <h3>{titulo}</h3>
    <p>{nota}</p>
  </div>
);


const API_URL =
  "https://script.google.com/macros/s/AKfycbzXAyHDhQodgu5mvasl-X6Nh5cHX5Rx700ZscoR6Aebp0Lg3iRTPH6VWGZPz86aDJpE/exec";

/* ---------------- Helpers ---------------- */
const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v) => {
  const n = Number(clean(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};
const toDate = (v) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const localDay = (v) => {
  if (!v) return "";
  const d = toDate(v);
  if (!d) return clean(v).split("T")[0];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Eliminar las funciones fetchSheet, fetchCatalogo y fetchResumen locales
// Ahora usamos las de cacheProtocolo.js

/* ============================================================
   COMPONENTE
   ============================================================ */
export const Dashboard = ({ user: propUser, onLogout }) => {
  const [tab, setTab] = useState("hoy");
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uidActual, setUidActual] = useState(null);

  const [config, setConfig] = useState(null);
  const [pesos, setPesos] = useState([]);
  const [comidas, setComidas] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [rutinaSemana, setRutinaSemana] = useState([]);
  const [rutinaEj, setRutinaEj] = useState([]);
  const [ajustes, setAjustes] = useState([]);
  const [susts, setSusts] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [tipIdx, setTipIdx] = useState(0);

  const navigate = useNavigate();
  const hoy = useMemo(() => localDay(new Date()), []);
  const diaSemana = DIAS[new Date().getDay()];

  /* ---------- Carga ---------- */
  // Carga COMPLETA: catálogos (cacheados) + registros + resumen, TODO en paralelo.
  const cargar = useCallback(async (uid, forzarRed = false) => {
    setLoading(true);
    const hoyStr = localDay(new Date());

    // Usamos fetchSheetCached con callbacks para carga instantánea desde caché local
    let configData, pesosData, comidasData, planesData, rutinaSemanaData,
      rutinaEjData, ajustesData, sustsData, resumenData;

    // Cargar catálogos en paralelo
    await Promise.all([
      new Promise((resolve) => {
        fetchSheetCached("Perfil_Config", (data, origen) => {
          configData = data;
          console.log("Perfil_Config desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Registro_Peso", (data, origen) => {
          pesosData = data;
          console.log("Registro_Peso desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Plan_Comidas", (data, origen) => {
          comidasData = data;
          console.log("Plan_Comidas desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Planes", (data, origen) => {
          planesData = data;
          console.log("Planes desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Rutina_Semana", (data, origen) => {
          rutinaSemanaData = data;
          console.log("Rutina_Semana desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Rutina_Ejercicios", (data, origen) => {
          rutinaEjData = data;
          console.log("Rutina_Ejercicios desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Ref_Ajustes", (data, origen) => {
          ajustesData = data;
          console.log("Ref_Ajustes desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Ref_Sustituciones", (data, origen) => {
          sustsData = data;
          console.log("Ref_Sustituciones desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchResumenCached(uid, hoyStr, (data, origen) => {
          resumenData = data;
          console.log("Resumen desde:", origen);
          resolve();
        }, forzarRed);
      }),
    ]);

    setConfig(configData?.[0] || null);
    setPesos(pesosData || []);
    setComidas(comidasData || []);
    setPlanes(planesData || []);
    setRutinaSemana(rutinaSemanaData || []);
    setRutinaEj(rutinaEjData || []);
    setAjustes(ajustesData || []);
    setSusts(sustsData || []);
    setResumen(resumenData && resumenData.status === "success" ? resumenData : null);
    setLoading(false);
  }, []);

  // Recarga LIGERA: solo lo que cambia al registrar (peso + resumen). Sin bloquear con "loading".
  const recargarLigero = useCallback(async (uid, forzarRed = false) => {
    const hoyStr = localDay(new Date());

    // Recarga solo lo que cambia
    await Promise.all([
      new Promise((resolve) => {
        fetchSheetCached("Registro_Peso", (data, origen) => {
          setPesos(data);
          console.log("Registro_Peso (ligero) desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchResumenCached(uid, hoyStr, (data, origen) => {
          if (data && data.status === "success") {
            setResumen(data);
          }
          console.log("Resumen (ligero) desde:", origen);
          resolve();
        }, forzarRed);
      }),
    ]);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("userSession");
    if (!propUser && !saved) {
      navigate("/");
      return;
    }
    const u = propUser || JSON.parse(saved);
    setUserData(u);
    const uid = clean(u.id) || clean(u.usuario_id) || "1";
    setUidActual(uid);
    cargar(uid);
  }, [propUser, navigate, cargar]);

  // Al volver a Hoy: recarga SOLO lo que cambia (rápido, sin pantalla de carga)
  useEffect(() => {
    if (tab === "hoy" && uidActual) {
      recargarLigero(uidActual);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const logout = () => {
    localStorage.removeItem("userSession");
    if (onLogout) onLogout();
    navigate("/");
  };

  /* ---------- Derivados ---------- */
  const ultimoPeso = useMemo(() => {
    if (!pesos.length) return null;
    const ord = [...pesos]
      .filter((p) => clean(p.peso_kg))
      .sort((a, b) => (toDate(b.fecha)?.getTime() || 0) - (toDate(a.fecha)?.getTime() || 0));
    return ord[0] || null;
  }, [pesos]);

  const pesoInicial = num(config?.peso_inicial_kg) || 82.45;
  const metaPeso = num(config?.meta_peso_kg) || 73;
  const pesoActual = ultimoPeso ? num(ultimoPeso.peso_kg) : pesoInicial;
  const faltaKg = Math.max(0, pesoActual - metaPeso);
  const perdidoKg = Math.max(0, pesoInicial - pesoActual);
  const totalCamino = Math.max(0.1, pesoInicial - metaPeso);
  const progresoPeso = Math.min(100, Math.round((perdidoKg / totalCamino) * 100));

  // Semana actual del protocolo según fecha de inicio
  const semanaActual = useMemo(() => {
    const inicio = toDate(config?.fecha_inicio);
    if (!inicio) return 1;
    const diff = Math.floor((new Date() - inicio) / (1000 * 60 * 60 * 24));
    return Math.min(12, Math.max(1, Math.floor(diff / 7) + 1));
  }, [config]);

  const planSemana = useMemo(
    () => planes.find((p) => clean(p.semana || p.id) === String(semanaActual)) || planes[semanaActual - 1] || null,
    [planes, semanaActual]
  );

  // Meta de peso de la semana actual (de la tabla Planes) y comparación con el peso real
  const metaSemanal = useMemo(() => {
    if (!planSemana) return null;
    const metaPesoSemana = num(planSemana.peso_meta_fin_kg);
    if (!metaPesoSemana) return null;
    const diff = pesoActual - metaPesoSemana; // + = por encima de la meta de la semana
    let estado, mensaje;
    if (!ultimoPeso) {
      estado = "sin_datos";
      mensaje = `Tu meta para el final de la semana ${semanaActual} es ${metaPesoSemana} kg. Registra tu peso para comparar.`;
    } else if (diff <= 0.3) {
      estado = "verde";
      mensaje = `Vas en línea o adelantado. Meta de la semana: ${metaPesoSemana} kg.`;
    } else if (diff <= 1.2) {
      estado = "amarillo";
      mensaje = `Estás ${diff.toFixed(1)} kg por encima de la meta de esta semana. Ritmo recuperable.`;
    } else {
      estado = "rojo";
      mensaje = `Vas ${diff.toFixed(1)} kg por encima de lo previsto para la semana ${semanaActual}. Revisa adherencia.`;
    }
    return { metaPesoSemana, diff, estado, mensaje };
  }, [planSemana, pesoActual, ultimoPeso, semanaActual]);

  const comidasHoy = useMemo(() => {
    return comidas
      .filter((c) => clean(c.semana) === String(semanaActual) && clean(c.dia_semana) === diaSemana)
      .sort((a, b) => num(a.id) - num(b.id));
  }, [comidas, semanaActual, diaSemana]);

  const entrenoHoy = useMemo(
    () => rutinaSemana.find((r) => clean(r.dia_semana) === diaSemana) || null,
    [rutinaSemana, diaSemana]
  );
  const ejerciciosHoy = useMemo(() => {
    if (!entrenoHoy || !clean(entrenoHoy.rutina_id)) return [];
    return rutinaEj
      .filter((e) => clean(e.rutina_id) === clean(entrenoHoy.rutina_id))
      .sort((a, b) => num(a.orden) - num(b.orden));
  }, [entrenoHoy, rutinaEj]);

  // Meta semanal de kcal por actividad (7700)
  const metaSemanalKcal = num(config?.meta_kcal_semanal_ejercicio) || 7700;
  const gastoHoy = resumen ? num(resumen.gasto_total_kcal) : 0;

  // Tips rotativos desde Ref_Ajustes + Ref_Sustituciones
  const tips = useMemo(() => {
    const t = [];
    ajustes.forEach((a) => {
      const si = clean(a.si_pasa), ac = clean(a.ajuste);
      if (si && ac) t.push({ tag: "AJUSTE", txt: `${si} → ${ac}` });
    });
    susts.forEach((s) => {
      const e = clean(s.en_vez_de), u = clean(s.puedes_usar);
      if (e && u) t.push({ tag: "SUSTITUYE", txt: `${e} → ${u}` });
    });
    if (!t.length) t.push({ tag: "REGLA", txt: "Proteína primero, siempre. Es lo que protege tu músculo." });
    return t;
  }, [ajustes, susts]);

  useEffect(() => {
    if (tips.length < 2) return;
    const id = setInterval(() => setTipIdx((i) => (i + 1) % tips.length), 6000);
    return () => clearInterval(id);
  }, [tips]);

  const nombre = clean(userData?.nombre) || "Alejo";
  const primerNombre = nombre.split(" ")[0];

  /* ---------- Estados del semáforo de déficit ---------- */
  const estadoColor = {
    verde: "var(--acid)",
    amarillo: "var(--gold)",
    rojo: "var(--fire)",
    sin_datos: "var(--dim)",
  };

  /* ============================================================
     RENDER: MURO "HOY"
     Envuelto en .p60-page para que se comporte igual que
     .plan-wrap y .prg-wrap (contenedor "tonto" que fluye
     dentro de .p60-main y ocupa el ancho completo).
     ============================================================ */
  const renderHoy = () => (
    <div className="p60-page">
      <div className="p60-wall">

        {/* HÉROE — estado actual */}
        <section className="p60-card p60-hero">
          <div className="p60-hero-top">
            <span className="p60-eyebrow">ESTADO ACTUAL</span>
            <span className="p60-week">SEM {semanaActual}/12</span>
          </div>
          <div className="p60-hero-weight">
            <b>{pesoActual.toFixed(2)}</b>
            <span>kg</span>
          </div>
          <div className="p60-hero-sub">
            {faltaKg > 0 ? (
              <>Te faltan <b>{faltaKg.toFixed(1)} kg</b> para tu meta de {metaPeso} kg</>
            ) : (
              <>Meta alcanzada. ¡{metaPeso} kg!</>
            )}
          </div>
          <div className="p60-progress">
            <div className="p60-progress-bar" style={{ width: `${progresoPeso}%` }} />
          </div>
          <div className="p60-progress-labels">
            <span>{pesoInicial} kg</span>
            <span className="p60-progress-pct">{progresoPeso}%</span>
            <span>{metaPeso} kg</span>
          </div>
        </section>

        {/* META SEMANAL — dónde deberías estar esta semana */}
        {metaSemanal && (
          <section className="p60-card p60-metasem" style={{ "--estado": estadoColor[metaSemanal.estado] || "var(--dim)" }}>
            <div className="p60-card-head">
              <span className="p60-eyebrow">META DE LA SEMANA {semanaActual}</span>
              <span className="p60-dot-estado" />
            </div>
            <div className="p60-metasem-row">
              <div className="p60-metasem-target">
                <span>DEBERÍAS PESAR</span>
                <b>{metaSemanal.metaPesoSemana}<i>kg</i></b>
              </div>
              <div className="p60-metasem-vs">vs</div>
              <div className="p60-metasem-real">
                <span>PESO ACTUAL</span>
                <b>{pesoActual.toFixed(1)}<i>kg</i></b>
              </div>
            </div>
            <p className="p60-metasem-msg">{metaSemanal.mensaje}</p>
          </section>
        )}

        {/* DÉFICIT DE HOY */}
        <section className="p60-card p60-deficit" style={{ "--estado": estadoColor[resumen?.estado] || "var(--dim)" }}>
          <div className="p60-card-head">
            <span className="p60-eyebrow">DÉFICIT DE HOY</span>
            <span className="p60-dot-estado" />
          </div>
          {resumen ? (
            <>
              <div className="p60-deficit-num">
                <b>{num(resumen.deficit_kcal)}</b>
                <span>kcal</span>
              </div>
              <p className="p60-deficit-msg">{clean(resumen.mensaje)}</p>
              <div className="p60-deficit-break">
                <div><span>GASTO</span><b>{num(resumen.gasto_total_kcal)}</b></div>
                <div><span>INGESTA</span><b>{num(resumen.ingesta_total_kcal)}</b></div>
                <div><span>PROTEÍNA</span><b>{num(resumen.proteina_plan_g)}g</b></div>
              </div>
            </>
          ) : (
            <div className="p60-empty-inline">
              Aún no hay datos de hoy. Registra tu gasto del Garmin para ver tu déficit.
              <button className="p60-mini-btn" onClick={() => setTab("registrar")}>Registrar ahora</button>
            </div>
          )}
        </section>

        {/* META SEMANAL DE KCAL */}
        <section className="p60-card p60-kcal-week">
          <div className="p60-card-head">
            <span className="p60-eyebrow">GASTO REGISTRADO HOY</span>
          </div>
          <div className="p60-kcal-row">
            <div className="p60-ring" style={{ "--pct": Math.min(100, Math.round((gastoHoy / (metaSemanalKcal / 7)) * 100)) }}>
              <span>{Math.min(100, Math.round((gastoHoy / (metaSemanalKcal / 7)) * 100))}%</span>
            </div>
            <div className="p60-kcal-info">
              <b>{gastoHoy} <i>kcal</i></b>
              <span>Meta diaria aprox: {Math.round(metaSemanalKcal / 7)} kcal · {metaSemanalKcal} / semana</span>
            </div>
          </div>
        </section>

        {/* ENTRENAMIENTO DE HOY */}
        <section className="p60-card">
          <div className="p60-card-head">
            <span className="p60-eyebrow">ENTRENAMIENTO · {diaSemana.toUpperCase()}</span>
          </div>
          {entrenoHoy ? (
            <>
              <h3 className="p60-card-title-lg">{clean(entrenoHoy.sesion) || "Sesión"}</h3>
              {clean(entrenoHoy.cardio_incluido) && clean(entrenoHoy.cardio_incluido) !== "—" && (
                <p className="p60-card-note">🏃 {clean(entrenoHoy.cardio_incluido)}</p>
              )}
              {ejerciciosHoy.length > 0 ? (
                <ul className="p60-ex-list">
                  {ejerciciosHoy.slice(0, 4).map((e, i) => (
                    <li key={i}>
                      <span>{clean(e.nombre_ejercicio)}</span>
                      <b>{clean(e.series)} × {clean(e.repeticiones)}</b>
                    </li>
                  ))}
                  {ejerciciosHoy.length > 4 && (
                    <li className="p60-ex-more">+{ejerciciosHoy.length - 4} ejercicios más</li>
                  )}
                </ul>
              ) : (
                <p className="p60-rest-note">Día de descanso o cardio libre. Recupera bien.</p>
              )}
              <button className="p60-card-btn" onClick={() => setTab("plan")}>Ver rutina completa</button>
            </>
          ) : (
            <p className="p60-empty-inline">No hay entrenamiento asignado para hoy.</p>
          )}
        </section>

        {/* ALIMENTACIÓN DE HOY */}
        <section className="p60-card">
          <div className="p60-card-head">
            <span className="p60-eyebrow">ALIMENTACIÓN · HOY</span>
            {planSemana && <span className="p60-week">{num(planSemana.kcal_objetivo_dia)} kcal</span>}
          </div>
          {comidasHoy.length > 0 ? (
            <>
              <ul className="p60-meal-list">
                {comidasHoy.map((c, i) => (
                  <li key={i}>
                    <div className="p60-meal-when">{clean(c.momento)}</div>
                    <div className="p60-meal-desc">{clean(c.descripcion)}</div>
                    <div className="p60-meal-kcal">{num(c.kcal_aprox)}</div>
                  </li>
                ))}
              </ul>
              <button className="p60-card-btn" onClick={() => setTab("registrar")}>Marcar lo que comí</button>
            </>
          ) : (
            <p className="p60-empty-inline">No hay comidas cargadas para hoy en el plan.</p>
          )}
        </section>

        {/* TIP DEL DÍA */}
        <section className="p60-card p60-tip">
          <span className="p60-tip-tag">{tips[tipIdx]?.tag}</span>
          <p>{tips[tipIdx]?.txt}</p>
          {tips.length > 1 && (
            <div className="p60-tip-dots">
              {tips.slice(0, 6).map((_, i) => (
                <span key={i} className={i === tipIdx % 6 ? "on" : ""} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );

  /* ============================================================
     RENDER PRINCIPAL
     ============================================================ */
  if (!userData) return <div className="p60-loader">Cargando…</div>;

  const NAV = [
    { id: "hoy", label: "Hoy", icon: "◉" },
    { id: "registrar", label: "Registrar", icon: "＋" },
    { id: "progreso", label: "Progreso", icon: "◔" },
    { id: "plan", label: "Plan", icon: "▤" },
  ];

  return (
    <div className="p60-dash">
      {/* TOP BAR */}
      <header className="p60-topbar">
        <div className="p60-topbar-left">
          <span className="p60-topbar-brand">PROTOCOLO <b>60</b></span>
          <span className="p60-topbar-hi">Hola, {primerNombre}</span>
        </div>
        <button className="p60-sync" onClick={() => {
          invalidarTodo();
          cargar(uidActual, true);
        }} title="Sincronizar datos">⟳</button>
        <button className="p60-logout" onClick={logout} title="Cerrar sesión">⏻</button>
      </header>

      {/* CONTENIDO */}
      <main className="p60-main">
        {loading && tab === "hoy" ? (
          <div className="p60-page">
            <div className="p60-loading-state">
              <div className="p60-loading-orb">
                <span className="p60-loading-ring" />
                <span className="p60-loading-core">60</span>
              </div>
              <p className="p60-loading-txt">Cargando tus datos…</p>
              <div className="p60-skeleton-wall">
                {[0, 1, 2].map((i) => <div key={i} className="p60-skeleton" />)}
              </div>
            </div>
          </div>
        ) : (
          <>
            {tab === "hoy" && renderHoy()}
            {tab === "registrar" && <RegistrarSection user={userData} />}
            {tab === "progreso" && <ProgresoSection user={userData} />}
            {tab === "plan" && <PlanSection user={userData} />}
          </>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav className="p60-bottomnav">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`p60-navbtn ${tab === n.id ? "on" : ""}`}
            onClick={() => setTab(n.id)}
          >
            <span className="p60-navicon">{n.icon}</span>
            <span className="p60-navlabel">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};