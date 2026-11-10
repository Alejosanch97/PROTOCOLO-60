import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchSheetCached } from "./cacheProtocolo";

const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());

const ProtocoloContext = createContext(null);

/**
 * Carga los catálogos (Perfil_Config, Planes, Plan_Comidas, Rutina_Semana,
 * Rutinas, Rutina_Ejercicios, Ref_Ajustes, Ref_Sustituciones) UNA SOLA VEZ
 * por sesión, y los comparte con Dashboard, Plan, Progreso y Registrar.
 */
export const ProtocoloProvider = ({ uid, children }) => {
  const [estado, setEstado] = useState({
    config: null,
    comidas: [],
    planes: [],
    rutinaSemana: [],
    rutinas: [],
    rutinaEj: [],
    ajustes: [],
    susts: [],
  });
  const [listo, setListo] = useState(false);

  const cargarCatalogos = useCallback(async (forzarRed = false) => {
    if (!uid) return;

    let configData, comidasData, planesData, rutinaSemanaData, rutinasData, rutinaEjData, ajustesData, sustsData;

    await Promise.all([
      new Promise((resolve) => {
        fetchSheetCached("Perfil_Config", (data) => {
          configData = data.filter((row) => clean(row.usuario_id) === uid);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Plan_Comidas", (data) => { comidasData = data; resolve(); }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Planes", (data) => {
          planesData = data.filter((row) => clean(row.usuario_id) === uid);
          resolve();
        }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Rutina_Semana", (data) => { rutinaSemanaData = data; resolve(); }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Rutinas", (data) => { rutinasData = data; resolve(); }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Rutina_Ejercicios", (data) => { rutinaEjData = data; resolve(); }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Ref_Ajustes", (data) => { ajustesData = data; resolve(); }, forzarRed);
      }),
      new Promise((resolve) => {
        fetchSheetCached("Ref_Sustituciones", (data) => { sustsData = data; resolve(); }, forzarRed);
      }),
    ]);

    setEstado({
      config: configData?.[0] || null,
      comidas: comidasData || [],
      planes: planesData || [],
      rutinaSemana: rutinaSemanaData || [],
      rutinas: rutinasData || [],
      rutinaEj: rutinaEjData || [],
      ajustes: ajustesData || [],
      susts: sustsData || [],
    });
    setListo(true);
  }, [uid]);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  // Llamar tras reiniciar etapa (cambia fecha_inicio en Perfil_Config)
  const refrescarConfig = useCallback(() => cargarCatalogos(true), [cargarCatalogos]);
  // Fuerza recarga de TODOS los catálogos (botón de sincronizar)
  const recargarTodo = useCallback(() => cargarCatalogos(true), [cargarCatalogos]);

  return (
    <ProtocoloContext.Provider value={{ ...estado, listo, refrescarConfig, recargarTodo }}>
      {children}
    </ProtocoloContext.Provider>
  );
};

export const useProtocolo = () => {
  const ctx = useContext(ProtocoloContext);
  if (!ctx) throw new Error("useProtocolo debe usarse dentro de <ProtocoloProvider>");
  return ctx;
};