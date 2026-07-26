import React, { useState, useEffect } from "react";
import "../Styles/home.css";
import { useNavigate } from "react-router-dom";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzXAyHDhQodgu5mvasl-X6Nh5cHX5Rx700ZscoR6Aebp0Lg3iRTPH6VWGZPz86aDJpE/exec";

export const Home = ({ onLoginSuccess }) => {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState("");

  const navigate = useNavigate();

  // Reloj vivo para el panel — refuerza el aire de "sistema activo"
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      setClock(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleInputChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "login",
          sheet: "Usuarios",
          email: credentials.email.trim(),
          password: credentials.password.trim(),
        }),
      });
      const result = await response.json();

      if (result.status === "success") {
        localStorage.setItem("userSession", JSON.stringify(result));
        if (onLoginSuccess) onLoginSuccess(result);
        navigate("/dashboard");
      } else {
        setError(result.message || "Credenciales inválidas. Revisa tu usuario y contraseña.");
      }
    } catch (err) {
      console.error("Error:", err);
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p60-login">
      {/* ---------- PANEL IZQUIERDO / MARCA ---------- */}
      <aside className="p60-brand-side">
        <div className="p60-grain" aria-hidden="true"></div>

        <div className="p60-brand-top">
          <span className="p60-tag">SISTEMA / ACCESO PRIVADO</span>
          <span className="p60-clock">{clock}</span>
        </div>

        <div className="p60-brand-core">
          <h1 className="p60-logo">
            PROTOCOLO <span>60</span>
          </h1>
          <p className="p60-slogan">
            Control total de déficit, nutrición y entrenamiento inteligente en una sola plataforma.
          </p>

          <div className="p60-stats">
            <div className="p60-stat">
              <b>100%</b>
              <span>PERSONALIZADO</span>
            </div>
            <div className="p60-stat">
              <b>360°</b>
              <span>RUTINAS Y DIETA</span>
            </div>
            <div className="p60-stat">
              <b>IA</b>
              <span>MÉTRICAS Y CONTROL</span>
            </div>
            <div className="p60-stat">
              <b>PRO</b>
              <span>EVOLUCIÓN DIARIA</span>
            </div>
          </div>
        </div>

        <div className="p60-brand-foot">
          <div className="p60-rule">— OPTIMIZACIÓN METABÓLICA Y RENDIMIENTO</div>
          <div className="p60-rule">— CONSISTENCIA SOBRE INTENSIDAD</div>
        </div>
      </aside>

      {/* ---------- PANEL DERECHO / FORMULARIO ---------- */}
      <main className="p60-form-side">
        <div className="p60-card">
          <div className="p60-card-eyebrow">
            <span className="p60-dot"></span>
            AUTENTICACIÓN
          </div>

          <h2 className="p60-card-title">Inicia tu sesión</h2>
          <p className="p60-card-sub">Entra para registrar tu día y ver cuánto te falta para la meta.</p>

          <form onSubmit={handleSubmit} className="p60-form">
            <div className="p60-field">
              <label htmlFor="email">Usuario</label>
              <input
                id="email"
                type="text"
                name="email"
                autoComplete="username"
                placeholder="Ej. User"
                value={credentials.email}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="p60-field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={credentials.password}
                onChange={handleInputChange}
                required
              />
            </div>

            {error && (
              <div className="p60-error" role="alert">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="p60-btn" disabled={loading}>
              {loading ? (
                <span className="p60-loading">
                  <span className="p60-spinner"></span>
                  Verificando…
                </span>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <div className="p60-card-foot">
            <span>ACCESO PERSONAL</span>
            <span>V1.0</span>
          </div>
        </div>
      </main>
    </div>
  );
};