import React, { useState, useEffect, useCallback, useMemo } from "react";
import "../Styles/registrar.css";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzXAyHDhQodgu5mvasl-X6Nh5cHX5Rx700ZscoR6Aebp0Lg3iRTPH6VWGZPz86aDJpE/exec";

/* ---------- Helpers ---------- */
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

const fetchSheet = async (sheet) => {
  try {
    const res = await fetch(`${API_URL}?sheet=${encodeURIComponent(sheet)}`);
    const txt = await res.text();
    const d = JSON.parse(txt);
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
};

/**
 * POST con reintento. Apps Script a veces responde no-JSON o falla si dos
 * escrituras coinciden; reintenta hasta 2 veces con pausa corta.
 */
const postSheet = async (sheet, data, action = "create", intentos = 2) => {
  for (let i = 0; i <= intentos; i++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        redirect: "follow",
        // text/plain evita el preflight CORS que rompe el redirect 302 de Apps Script
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, sheet, data }),
      });
      const txt = await res.text();
      try {
        const j = JSON.parse(txt);
        if (j.status === "error") throw new Error(j.message);
        return j;
      } catch (e) {
        if (e instanceof SyntaxError) return { status: "success" }; // no-JSON = OK en Apps Script
        throw e;
      }
    } catch (e) {
      if (i === intentos) throw e;
      await new Promise((r) => setTimeout(r, 600));
    }
  }
};

/* ============================================================
   COMPONENTE
   ============================================================ */
export const RegistrarSection = ({ user }) => {
  const hoy = useMemo(() => localDay(new Date()), []);
  const diaSemana = DIAS[new Date().getDay()];
  const uid = clean(user?.id) || clean(user?.usuario_id) || "1";

  const [sub, setSub] = useState("gasto"); // gasto | gym | peso | agua | comida
  const [toast, setToast] = useState("");
  const [syncing, setSyncing] = useState(false);

  const [config, setConfig] = useState(null);
  const [comidas, setComidas] = useState([]);
  const [cumplidos, setCumplidos] = useState([]);
  // Set de ids marcados HOY. Se pinta al instante al hacer clic y se rellena en la carga.
  const [marcados, setMarcados] = useState(new Set());

  const [hechoHoy, setHechoHoy] = useState({ gasto: false, peso: false, agua: false });

  /* Formularios */
  const [gasto, setGasto] = useState({ total: "", activo: "", reposo: "", pasos: "", fc: "" });
  const ETAPAS = [
    { id: 1, nombre: "Caminata laboral" },
    { id: 2, nombre: "Caminata casa → gym" },
    { id: 3, nombre: "Caminata gym → casa" },
    { id: 4, nombre: "Cardio inicial" },
    { id: 5, nombre: "Rutina de fuerza" },
    { id: 6, nombre: "Cardio final" },
  ];
  const [etapas, setEtapas] = useState({});
  const totalEtapas = Object.values(etapas).reduce((a, v) => a + num(v), 0);
  const [peso, setPeso] = useState({
    peso_kg: "", grasa: "", musculo: "", masa_muscular: "", tmb: "", peso_sin_grasa: "", agua_pct: "", imc: "",
  });
  const [agua, setAgua] = useState("");
  const [extra, setExtra] = useState({ momento: "Snack", descripcion: "", kcal: "" });

  /* ---------- Carga ---------- */
  const cargar = useCallback(async () => {
    const [cfg, cm, cp, gastoRows, pesoRows, aguaRows] = await Promise.all([
      fetchSheet("Perfil_Config"),
      fetchSheet("Plan_Comidas"),
      fetchSheet("Registro_Plan_Cumplido"),
      fetchSheet("Registro_Gasto_Diario"),
      fetchSheet("Registro_Peso"),
      fetchSheet("Registro_Agua"),
    ]);
    setConfig(cfg[0] || null);
    setComidas(cm);
    setCumplidos(cp);

    // Reconstruye el set de marcados de hoy desde el backend
    const hoyStr0 = localDay(new Date());
    const setInicial = new Set();
    cp.forEach((r) => {
      if (
        clean(r.usuario_id) === uid &&
        localDay(r.fecha) === hoyStr0 &&
        clean(r.cumplido).toUpperCase() === "SI"
      ) {
        setInicial.add(clean(r.plan_comida_id));
      }
    });
    setMarcados(setInicial);

    const hoyStr = localDay(new Date());
    const yaHay = (rows) =>
      rows.some((r) => clean(r.usuario_id) === uid && localDay(r.fecha) === hoyStr);
    setHechoHoy({
      gasto: yaHay(gastoRows),
      peso: yaHay(pesoRows),
      agua: yaHay(aguaRows),
    });
  }, [uid]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const mostrarToast = (t) => {
    setToast(t);
    setTimeout(() => setToast(""), 3000);
  };

  const semanaActual = useMemo(() => {
    const inicio = toDate(config?.fecha_inicio);
    if (!inicio) return 1;
    const diff = Math.floor((new Date() - inicio) / (1000 * 60 * 60 * 24));
    return Math.min(12, Math.max(1, Math.floor(diff / 7) + 1));
  }, [config]);

  const comidasHoy = useMemo(
    () =>
      comidas
        .filter((c) => clean(c.semana) === String(semanaActual) && clean(c.dia_semana) === diaSemana)
        .sort((a, b) => num(a.id) - num(b.id)),
    [comidas, semanaActual, diaSemana]
  );

  // marcadosHoy ahora es directamente el Set en estado (instantáneo)
  const marcadosHoy = marcados;

  /* ============================================================
     GUARDADOS OPTIMISTAS
     ============================================================ */

  const guardarGasto = () => {
    if (!clean(gasto.total)) return mostrarToast("Escribe al menos el gasto total");
    const snapshot = { ...gasto };
    setGasto({ total: "", activo: "", reposo: "", pasos: "", fc: "" });
    setHechoHoy((h) => ({ ...h, gasto: true }));
    mostrarToast("Gasto guardado");
    setSyncing(true);
    postSheet("Registro_Gasto_Diario", {
      usuario_id: uid,
      fecha: hoy,
      gasto_total_kcal: num(snapshot.total),
      activo_kcal: num(snapshot.activo),
      reposo_kcal: num(snapshot.reposo),
      pasos: num(snapshot.pasos),
      fc_max_sesion: num(snapshot.fc),
      notas: "",
    })
      .catch((e) => {
        setHechoHoy((h) => ({ ...h, gasto: false }));
        setGasto(snapshot);
        mostrarToast(`No se guardó: ${e.message}`);
      })
      .finally(() => setSyncing(false));
  };

  const guardarPeso = () => {
    if (!clean(peso.peso_kg)) return mostrarToast("Escribe tu peso");
    const snapshot = { ...peso };
    const ahora = new Date();
    setPeso({ peso_kg: "", grasa: "", musculo: "", masa_muscular: "", tmb: "", peso_sin_grasa: "", agua_pct: "", imc: "" });
    setHechoHoy((h) => ({ ...h, peso: true }));
    mostrarToast("Peso registrado");
    setSyncing(true);
    postSheet("Registro_Peso", {
      usuario_id: uid,
      fecha: hoy,
      hora: `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`,
      peso_kg: num(snapshot.peso_kg),
      imc: num(snapshot.imc),
      grasa_corporal_pct: num(snapshot.grasa),
      musculo_esqueletico_pct: num(snapshot.musculo),
      masa_muscular_kg: num(snapshot.masa_muscular),
      tmb_kcal: num(snapshot.tmb),
      peso_sin_grasa_kg: num(snapshot.peso_sin_grasa),
      agua_pct: num(snapshot.agua_pct),
      notas: "",
    })
      .catch((e) => {
        setHechoHoy((h) => ({ ...h, peso: false }));
        setPeso(snapshot);
        mostrarToast(`No se guardó: ${e.message}`);
      })
      .finally(() => setSyncing(false));
  };

  const guardarAgua = () => {
    if (!clean(agua)) return mostrarToast("Escribe los ml");
    const snapshot = agua;
    const meta = num(config?.meta_agua_ml_dia) || 2900;
    setAgua("");
    setHechoHoy((h) => ({ ...h, agua: true }));
    mostrarToast("Agua registrada");
    setSyncing(true);
    postSheet("Registro_Agua", {
      usuario_id: uid,
      fecha: hoy,
      ml_total: num(snapshot),
      meta_ml: meta,
      cumplio: num(snapshot) >= meta ? "SI" : "NO",
      notas: "",
    })
      .catch((e) => {
        setHechoHoy((h) => ({ ...h, agua: false }));
        setAgua(snapshot);
        mostrarToast(`No se guardó: ${e.message}`);
      })
      .finally(() => setSyncing(false));
  };

  const guardarExtra = () => {
    if (!clean(extra.descripcion) || !clean(extra.kcal)) return mostrarToast("Completa descripción y kcal");
    const snapshot = { ...extra };
    setExtra({ momento: "Snack", descripcion: "", kcal: "" });
    mostrarToast("Snack agregado");
    setSyncing(true);
    postSheet("Registro_Extra", {
      usuario_id: uid,
      fecha: hoy,
      momento: snapshot.momento,
      descripcion: snapshot.descripcion,
      kcal: num(snapshot.kcal),
      notas: "",
    })
      .catch((e) => {
        setExtra(snapshot);
        mostrarToast(`No se guardó: ${e.message}`);
      })
      .finally(() => setSyncing(false));
  };

  const guardarEtapas = () => {
    const aGuardar = ETAPAS.filter((e) => num(etapas[e.id]) > 0);
    if (aGuardar.length === 0) return mostrarToast("Anota al menos una etapa");
    const snapshot = { ...etapas };
    const total = totalEtapas;
    setEtapas({});
    mostrarToast(`${aGuardar.length} etapas guardadas (${total} kcal)`);
    setSyncing(true);
    (async () => {
      const fallidas = [];
      for (const e of aGuardar) {
        try {
          await postSheet("Registro_Actividad", {
            usuario_id: uid,
            fecha: hoy,
            actividad_id: e.id,
            duracion_min: "",
            kcal_gastadas: num(snapshot[e.id]),
            distancia_km: "",
            notas: e.nombre,
          });
        } catch {
          fallidas.push(e);
        }
      }
      if (fallidas.length) {
        const restaura = {};
        fallidas.forEach((e) => (restaura[e.id] = snapshot[e.id]));
        setEtapas(restaura);
        mostrarToast(`${fallidas.length} etapas no se guardaron, reintenta`);
      }
    })().finally(() => setSyncing(false));
  };

  // Marcar comida del plan (chulito) — instantáneo, sincroniza detrás
  const toggleComida = (comida) => {
    const id = clean(comida.id);
    if (marcados.has(id)) return; // ya marcado, no se puede desactivar

    // 1) PINTA YA: agrega al Set al instante (React re-renderiza el chulito verde)
    setMarcados((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    // 2) SINCRONIZA por detrás
    setSyncing(true);
    postSheet("Registro_Plan_Cumplido", {
      usuario_id: uid,
      fecha: hoy,
      semana: semanaActual,
      nivel: "comida",
      momento: clean(comida.momento),
      plan_comida_id: id,
      cumplido: "SI",
      notas: "",
    })
      .catch((e) => {
        // Si falla, lo quita del Set y avisa
        setMarcados((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        mostrarToast(`No se marcó: ${e.message}`);
      })
      .finally(() => setSyncing(false));
  };

  /* ---------- UI ---------- */
  const TABS = [
    { id: "gasto", label: "Gasto", icon: "🔥" },
    { id: "gym", label: "Gym", icon: "🏋" },
    { id: "peso", label: "Peso", icon: "⚖" },
    { id: "agua", label: "Agua", icon: "💧" },
    { id: "comida", label: "Comidas", icon: "🍽" },
  ];

  const AvisoHecho = ({ texto }) => (
    <div className="reg-done-banner">
      <span className="reg-done-check">✓</span>
      <div>
        <b>Ya registraste hoy</b>
        <p>{texto} Para no afectar los cálculos, solo se toma un registro por día.</p>
      </div>
    </div>
  );

  return (
    <div className="reg-wrap">
      <div className="reg-head">
        <h2 className="reg-title">Registrar</h2>
        <span className="reg-date">
          {diaSemana} · Semana {semanaActual}
          {syncing && <em className="reg-sync">● sincronizando</em>}
        </span>
      </div>

      {/* Sub-tabs */}
      <div className="reg-subtabs">
        {TABS.map((t) => (
          <button key={t.id} className={`reg-subtab ${sub === t.id ? "on" : ""}`} onClick={() => setSub(t.id)}>
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------- GASTO ---------- */}
      {sub === "gasto" && (
        <div className="reg-card">
          {hechoHoy.gasto ? (
            <AvisoHecho texto="El gasto del Garmin de hoy ya está guardado." />
          ) : (
            <>
              <p className="reg-card-desc">Copia el <b>Total</b> de calorías quemadas de tu Garmin. Es lo que define tu déficit de hoy.</p>
              <div className="reg-field big">
                <label>Gasto total (kcal)</label>
                <input type="number" inputMode="numeric" value={gasto.total} onChange={(e) => setGasto({ ...gasto, total: e.target.value })} placeholder="2820" />
              </div>
              <div className="reg-grid2">
                <div className="reg-field"><label>Activo</label><input type="number" value={gasto.activo} onChange={(e) => setGasto({ ...gasto, activo: e.target.value })} placeholder="915" /></div>
                <div className="reg-field"><label>Reposo</label><input type="number" value={gasto.reposo} onChange={(e) => setGasto({ ...gasto, reposo: e.target.value })} placeholder="1705" /></div>
                <div className="reg-field"><label>Pasos</label><input type="number" value={gasto.pasos} onChange={(e) => setGasto({ ...gasto, pasos: e.target.value })} placeholder="10644" /></div>
                <div className="reg-field"><label>FC máx</label><input type="number" value={gasto.fc} onChange={(e) => setGasto({ ...gasto, fc: e.target.value })} placeholder="183" /></div>
              </div>
              <button className="reg-save" onClick={guardarGasto}>Guardar gasto de hoy</button>
            </>
          )}
        </div>
      )}

      {/* ---------- GYM POR ETAPAS ---------- */}
      {sub === "gym" && (
        <div className="reg-card">
          <p className="reg-card-desc">
            Anota las kcal de cada etapa de tu día. Se suman como tu gasto por actividad.
            El déficit del día lo sigue calculando el <b>total del Garmin</b>.
          </p>
          <div className="reg-etapas">
            {ETAPAS.map((e) => (
              <div className="reg-etapa" key={e.id}>
                <span className="reg-etapa-name">{e.nombre}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="kcal"
                  value={etapas[e.id] || ""}
                  onChange={(ev) => setEtapas({ ...etapas, [e.id]: ev.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="reg-etapa-total">
            <span>TOTAL ETAPAS</span>
            <b>{totalEtapas} <i>kcal</i></b>
          </div>
          <button className="reg-save" onClick={guardarEtapas}>Guardar etapas del día</button>
        </div>
      )}

      {/* ---------- PESO ---------- */}
      {sub === "peso" && (
        <div className="reg-card">
          {hechoHoy.peso ? (
            <AvisoHecho texto="Tu peso de hoy ya quedó registrado." />
          ) : (
            <>
              <p className="reg-card-desc">Datos de tu báscula inteligente. Solo el peso es obligatorio; el resto es opcional.</p>
              <div className="reg-field big">
                <label>Peso (kg)</label>
                <input type="number" step="0.01" inputMode="decimal" value={peso.peso_kg} onChange={(e) => setPeso({ ...peso, peso_kg: e.target.value })} placeholder="82.45" />
              </div>
              <div className="reg-grid2">
                <div className="reg-field"><label>Grasa %</label><input type="number" step="0.1" value={peso.grasa} onChange={(e) => setPeso({ ...peso, grasa: e.target.value })} placeholder="23" /></div>
                <div className="reg-field"><label>IMC</label><input type="number" step="0.1" value={peso.imc} onChange={(e) => setPeso({ ...peso, imc: e.target.value })} placeholder="28.2" /></div>
                <div className="reg-field"><label>Músculo esq. %</label><input type="number" step="0.1" value={peso.musculo} onChange={(e) => setPeso({ ...peso, musculo: e.target.value })} placeholder="49.8" /></div>
                <div className="reg-field"><label>Masa muscular kg</label><input type="number" step="0.1" value={peso.masa_muscular} onChange={(e) => setPeso({ ...peso, masa_muscular: e.target.value })} placeholder="60.3" /></div>
                <div className="reg-field"><label>TMB kcal</label><input type="number" value={peso.tmb} onChange={(e) => setPeso({ ...peso, tmb: e.target.value })} placeholder="1741" /></div>
                <div className="reg-field"><label>Peso sin grasa</label><input type="number" step="0.1" value={peso.peso_sin_grasa} onChange={(e) => setPeso({ ...peso, peso_sin_grasa: e.target.value })} placeholder="63.5" /></div>
              </div>
              <button className="reg-save" onClick={guardarPeso}>Registrar peso</button>
            </>
          )}
        </div>
      )}

      {/* ---------- AGUA ---------- */}
      {sub === "agua" && (
        <div className="reg-card">
          {hechoHoy.agua ? (
            <AvisoHecho texto="El agua de hoy ya está registrada." />
          ) : (
            <>
              <p className="reg-card-desc">¿Cuánta agua llevas hoy? Meta: {num(config?.meta_agua_ml_dia) || 2900} ml.</p>
              <div className="reg-field big">
                <label>Agua total (ml)</label>
                <input type="number" inputMode="numeric" value={agua} onChange={(e) => setAgua(e.target.value)} placeholder="2900" />
              </div>
              <div className="reg-quick">
                {[250, 500, 750, 1000].map((q) => (
                  <button key={q} onClick={() => setAgua(String(num(agua) + q))}>+{q}</button>
                ))}
              </div>
              <button className="reg-save" onClick={guardarAgua}>Registrar agua</button>
            </>
          )}
        </div>
      )}

      {/* ---------- COMIDAS ---------- */}
      {sub === "comida" && (
        <>
          <div className="reg-card">
            <p className="reg-card-desc">Marca lo que comiste del plan de hoy. Cada chulito suma a tu ingesta del día.</p>
            <div className="reg-meals">
              {comidasHoy.length === 0 && <p className="reg-empty">No hay comidas cargadas para hoy.</p>}
              {comidasHoy.map((c) => {
                const marcada = marcadosHoy.has(clean(c.id));
                return (
                  <button key={c.id} className={`reg-meal ${marcada ? "done" : ""}`} onClick={() => toggleComida(c)} disabled={marcada}>
                    <span className={`reg-check ${marcada ? "on" : ""}`}>{marcada ? "✓" : ""}</span>
                    <span className="reg-meal-body">
                      <span className="reg-meal-when">{clean(c.momento)}</span>
                      <span className="reg-meal-desc">{clean(c.descripcion)}</span>
                    </span>
                    <span className="reg-meal-kcal">{num(c.kcal_aprox)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="reg-card">
            <p className="reg-card-desc">¿Comiste algo fuera del plan? Agrégalo como extra (solo kcal).</p>
            <div className="reg-chips">
              {["Desayuno", "Almuerzo", "Cena", "Snack"].map((m) => (
                <button key={m} className={`reg-chip ${extra.momento === m ? "on" : ""}`} onClick={() => setExtra({ ...extra, momento: m })}>{m}</button>
              ))}
            </div>
            <div className="reg-field"><label>¿Qué comiste?</label><input type="text" value={extra.descripcion} onChange={(e) => setExtra({ ...extra, descripcion: e.target.value })} placeholder="Papas fritas antojo" /></div>
            <div className="reg-field"><label>Calorías (kcal)</label><input type="number" inputMode="numeric" value={extra.kcal} onChange={(e) => setExtra({ ...extra, kcal: e.target.value })} placeholder="320" /></div>
            <button className="reg-save" onClick={guardarExtra}>Agregar extra</button>
          </div>
        </>
      )}

      {toast && <div className="reg-toast">{toast}</div>}
    </div>
  );
};