import React, { useState, useEffect, useCallback, useMemo } from "react";
import "../Styles/progreso.css";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { fetchSheetCached, postActionCached } from "./cacheProtocolo";

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
const fmtDia = (d) => (d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : "");

/* ---------- Tooltip personalizado (estética P60) ---------- */
const P60Tooltip = ({ active, payload, label, unidad, color }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="prg-tooltip">
      <span className="prg-tooltip-date">{label}</span>
      <span className="prg-tooltip-val" style={{ color }}>
        {payload[0].value}
        <i>{unidad}</i>
      </span>
    </div>
  );
};

/* ---------- Gráfica con Recharts ---------- */
const AreaChartP60 = ({ data, meta, color, label, unidad, gradId, invertida = false }) => {
  if (!data.length) return <div className="prg-nochart">Sin datos aún. Registra al menos 2 mediciones.</div>;

  const vals = data.map((d) => d.v);
  let min = Math.min(...vals, meta ?? Infinity);
  let max = Math.max(...vals, meta ?? -Infinity);
  const pad = (max - min) * 0.15 || 1;
  const dominio = [Number((min - pad).toFixed(1)), Number((max + pad).toFixed(1))];

  const primero = data[0].v;
  const ultimo = data[data.length - 1].v;
  const delta = ultimo - primero;
  const mejora = invertida ? delta < 0 : delta > 0;

  return (
    <div className="prg-chart">
      <div className="prg-chart-top">
        <div>
          <span className="prg-chart-label">{label}</span>
          <div className="prg-chart-val">
            <b>{ultimo}</b>
            <i>{unidad}</i>
          </div>
        </div>
        <span className={`prg-delta ${mejora ? "good" : "bad"}`}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {Math.abs(delta).toFixed(1)}
          {unidad}
        </span>
      </div>

      <div className="prg-chart-body">
        <ResponsiveContainer width="100%" height={170}>
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#232a35" strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey="fecha"
              tick={{ fill: "#7d8899", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={{ stroke: "#232a35" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={dominio}
              tick={{ fill: "#7d8899", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            <Tooltip
              content={<P60Tooltip unidad={unidad} color={color} />}
              cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "4 4", strokeOpacity: 0.5 }}
            />
            {meta != null && (
              <ReferenceLine
                y={meta}
                stroke="#ffb627"
                strokeDasharray="5 5"
                strokeOpacity={0.8}
                label={{
                  value: `meta ${meta}${unidad}`,
                  position: "insideBottomRight",
                  fill: "#ffb627",
                  fontSize: 9,
                  fontFamily: "JetBrains Mono, monospace",
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradId})`}
              dot={{ fill: color, r: 3, strokeWidth: 0 }}
              activeDot={{ fill: color, r: 5, stroke: "#0a0c10", strokeWidth: 2 }}
              animationDuration={700}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const ProgresoSection = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [pesos, setPesos] = useState([]);

  const uid = clean(user?.id) || clean(user?.usuario_id) || "1";

  const [semForm, setSemForm] = useState({ cintura: "", energia: "", saciedad: "", rendimiento: "" });
  const [semSaving, setSemSaving] = useState(false);
  const [semToast, setSemToast] = useState("");

  const cargar = useCallback(async (forzarRed = false) => {
    setLoading(true);

    let configData, pesosData;

    await Promise.all([
      new Promise((resolve) => {
        fetchSheetCached("Perfil_Config", (data, origen) => {
          configData = data;
          console.log("Progreso - Perfil_Config desde:", origen);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Registro_Peso", (data, origen) => {
          pesosData = data;
          console.log("Progreso - Registro_Peso desde:", origen);
          resolve();
        }, forzarRed);
      }),
    ]);

    setConfig(configData?.[0] || null);
    setPesos(pesosData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const serie = useMemo(() => {
    return pesos
      .filter((p) => clean(p.peso_kg) && (clean(p.usuario_id) === uid || !clean(p.usuario_id)))
      .map((p) => ({ d: toDate(p.fecha), row: p }))
      .filter((p) => p.d)
      .sort((a, b) => a.d - b.d);
  }, [pesos, uid]);

  const pesoPts = serie.map((s) => ({ v: num(s.row.peso_kg), fecha: fmtDia(s.d) }));
  const grasaPts = serie.filter((s) => clean(s.row.grasa_corporal_pct)).map((s) => ({ v: num(s.row.grasa_corporal_pct), fecha: fmtDia(s.d) }));
  const musculoPts = serie.filter((s) => clean(s.row.musculo_esqueletico_pct)).map((s) => ({ v: num(s.row.musculo_esqueletico_pct), fecha: fmtDia(s.d) }));

  const pesoInicial = num(config?.peso_inicial_kg) || (pesoPts[0]?.v ?? 82.45);
  const metaPeso = num(config?.meta_peso_kg) || 73;
  const metaGrasa = num(config?.meta_grasa_pct) || 15;
  const pesoActual = pesoPts.length ? pesoPts[pesoPts.length - 1].v : pesoInicial;

  const perdido = Math.max(0, pesoInicial - pesoActual);
  const totalObjetivo = Math.max(0.1, pesoInicial - metaPeso);
  const pctMeta = Math.min(100, Math.round((perdido / totalObjetivo) * 100));

  const ritmo = useMemo(() => {
    if (serie.length < 2) return null;
    const a = serie[serie.length - 2], b = serie[serie.length - 1];
    const dias = (b.d - a.d) / (1000 * 60 * 60 * 24);
    if (dias <= 0) return null;
    return ((num(a.row.peso_kg) - num(b.row.peso_kg)) / dias) * 7;
  }, [serie]);

  const ritmoEstado = useMemo(() => {
    if (ritmo == null) return null;
    if (ritmo > 1) return { txt: "Muy rápido — sube comida +150 kcal", cls: "bad" };
    if (ritmo >= 0.6) return { txt: "Ritmo ideal (0.6–0.8 kg/sem)", cls: "good" };
    if (ritmo >= 0.3) return { txt: "Ritmo lento pero válido", cls: "warn" };
    if (ritmo >= 0) return { txt: "Estancado — baja 100 kcal o +1 cardio", cls: "warn" };
    return { txt: "Subiendo de peso — revisa ingesta", cls: "bad" };
  }, [ritmo]);

  const guardarSemanal = async () => {
    setSemSaving(true);
    try {
      const inicio = toDate(config?.fecha_inicio);
      const semanaN = inicio ? Math.min(12, Math.max(1, Math.floor((new Date() - inicio) / (1000 * 60 * 60 * 24 * 7)) + 1)) : "";
      const hoyStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
      await postActionCached("Registro_Semanal", {
        usuario_id: uid,
        semana: semanaN,
        fecha_domingo: hoyStr,
        peso_promedio_kg: pesoActual.toFixed(1),
        grasa_pct: grasaPts.length ? grasaPts[grasaPts.length - 1].v : "",
        cintura_cm: num(semForm.cintura),
        energia_1a5: num(semForm.energia),
        saciedad_1a5: num(semForm.saciedad),
        rendimiento_1a5: num(semForm.rendimiento),
        notas: "",
      });
      setSemForm({ cintura: "", energia: "", saciedad: "", rendimiento: "" });
      setSemToast("Registro semanal guardado");
      setTimeout(() => setSemToast(""), 3000);
    } catch (e) {
      setSemToast(`Error: ${e.message}`);
      setTimeout(() => setSemToast(""), 3000);
    }
    setSemSaving(false);
  };

  /* ---------- LOADING ---------- */
  if (loading) {
    return (
      <div className="prg-loading-state">
        <div className="prg-loading-orb">
          <span className="prg-loading-ring" />
          <span className="prg-loading-core">60</span>
        </div>
        <p className="prg-loading-txt">Cargando tu progreso…</p>
        <div className="prg-skeleton-wall">
          {[0, 1, 2].map((i) => <div key={i} className="prg-skeleton" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="prg-wrap">
      <div className="prg-head">
        <h2 className="prg-title">Mi progreso</h2>
        <span className="prg-count">{serie.length} mediciones</span>
      </div>

      {/* Meta principal */}
      <div className="prg-goal-card">
        <div className="prg-goal-top">
          <span className="prg-eyebrow">CAMINO A LA META</span>
          <span className="prg-goal-pct">{pctMeta}%</span>
        </div>
        <div className="prg-goal-nums">
          <div><b>{pesoInicial}</b><span>inicio</span></div>
          <div className="prg-goal-arrow">→</div>
          <div className="prg-goal-now"><b>{pesoActual.toFixed(1)}</b><span>ahora</span></div>
          <div className="prg-goal-arrow">→</div>
          <div><b>{metaPeso}</b><span>meta</span></div>
        </div>
        <div className="prg-goal-bar"><div style={{ width: `${pctMeta}%` }} /></div>
        <p className="prg-goal-sub">Has perdido <b>{perdido.toFixed(1)} kg</b> · te faltan <b>{Math.max(0, pesoActual - metaPeso).toFixed(1)} kg</b></p>
      </div>

      {/* Ritmo semanal */}
      {ritmoEstado && (
        <div className={`prg-rhythm ${ritmoEstado.cls}`}>
          <div className="prg-rhythm-val">
            <b>{ritmo >= 0 ? "-" : "+"}{Math.abs(ritmo).toFixed(2)}</b>
            <span>kg/semana</span>
          </div>
          <p>{ritmoEstado.txt}</p>
        </div>
      )}

      {/* Gráficas Recharts */}
      <AreaChartP60 data={pesoPts} meta={metaPeso} color="#c8ff2f" label="Peso" unidad="kg" gradId="gradPeso" invertida />
      {grasaPts.length > 0 && (
        <AreaChartP60 data={grasaPts} meta={metaGrasa} color="#ff5c33" label="Grasa corporal" unidad="%" gradId="gradGrasa" invertida />
      )}
      {musculoPts.length > 0 && (
        <AreaChartP60 data={musculoPts} color="#38d6ff" label="Músculo esquelético" unidad="%" gradId="gradMusc" />
      )}

      {/* Metas del Excel */}
      <div className="prg-metas">
        <h3>Metas definidas</h3>
        <div className="prg-meta-row">
          <span>Peso objetivo</span>
          <b className={pesoActual <= metaPeso ? "ok" : ""}>{metaPeso} kg</b>
        </div>
        <div className="prg-meta-row">
          <span>Grasa objetivo</span>
          <b className={grasaPts.length && grasaPts[grasaPts.length - 1].v <= metaGrasa ? "ok" : ""}>{metaGrasa}%</b>
        </div>
        <div className="prg-meta-row">
          <span>Proteína diaria</span>
          <b>{num(config?.proteina_objetivo_g) || 165} g</b>
        </div>
        <div className="prg-meta-row">
          <span>Déficit objetivo</span>
          <b>{num(config?.deficit_objetivo_min) || 650}–{num(config?.deficit_objetivo_max) || 800} kcal</b>
        </div>
      </div>

      {semToast && <div className="prg-toast">{semToast}</div>}
    </div>
  );
};