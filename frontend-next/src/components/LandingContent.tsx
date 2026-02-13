"use client";

import Link from "next/link";
import { useIsMobile } from "../hooks/useIsMobile";

export function LandingContent() {
  const isMobile = useIsMobile();

  return (
    <div style={{ background: "var(--bg)" }}>
      {/* Hero Section */}
      <section
        style={{
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
          color: "white",
          padding: isMobile ? "60px 20px" : "100px 40px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h1
            style={{
              fontSize: isMobile ? "2rem" : "3rem",
              fontWeight: 800,
              marginBottom: 16,
              lineHeight: 1.2,
            }}
          >
            Compite con tus amigos prediciendo partidos de futbol
          </h1>
          <p
            style={{
              fontSize: isMobile ? "1rem" : "1.15rem",
              color: "rgba(255,255,255,0.75)",
              marginBottom: 12,
              lineHeight: 1.6,
              maxWidth: 650,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            La plataforma gratuita de quinielas, pollas, prodes y pencas deportivas.
            Sin dinero real, sin apuestas — solo entretenimiento puro entre amigos.
          </p>
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 32,
            }}
          >
            <Link
              href="/login"
              style={{
                background: "white",
                color: "#1a1a1a",
                padding: isMobile ? "14px 28px" : "16px 32px",
                borderRadius: 8,
                fontSize: isMobile ? "1rem" : "1.1rem",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Crear cuenta gratis
            </Link>
            <Link
              href="/como-funciona"
              style={{
                background: "transparent",
                color: "white",
                border: "2px solid rgba(255,255,255,0.5)",
                padding: isMobile ? "12px 26px" : "14px 30px",
                borderRadius: 8,
                fontSize: isMobile ? "1rem" : "1.1rem",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Ver como funciona
            </Link>
          </div>
        </div>
      </section>

      {/* What is Picks4All? — SEO text with regional keywords */}
      <section
        style={{
          padding: isMobile ? "48px 20px" : "64px 40px",
          maxWidth: 900,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? "1.5rem" : "2rem",
            fontWeight: 700,
            marginBottom: 16,
            color: "var(--text)",
          }}
        >
          Que es Picks4All?
        </h2>
        <p
          style={{
            color: "var(--muted)",
            fontSize: isMobile ? "0.95rem" : "1.05rem",
            lineHeight: 1.7,
            maxWidth: 750,
            margin: "0 auto 16px",
          }}
        >
          Picks4All es la plataforma gratuita para crear <strong style={{ color: "var(--text)" }}>quinielas deportivas</strong> online
          y competir con amigos, familia o companeros de trabajo prediciendo resultados de futbol.
          Tambien conocida como <strong style={{ color: "var(--text)" }}>polla futbolera</strong> en Colombia, Chile y Venezuela,{" "}
          <strong style={{ color: "var(--text)" }}>prode</strong> en Argentina,{" "}
          <strong style={{ color: "var(--text)" }}>penca</strong> en Uruguay, o{" "}
          <strong style={{ color: "var(--text)" }}>porra</strong> en Espana.
        </p>
        <p
          style={{
            color: "var(--muted)",
            fontSize: isMobile ? "0.95rem" : "1.05rem",
            lineHeight: 1.7,
            maxWidth: 750,
            margin: "0 auto",
          }}
        >
          Crea tu quiniela gratis, invita a quien quieras con un codigo, haz tus predicciones
          y compite en el leaderboard. <strong style={{ color: "var(--text)" }}>100% gratis y sin apuestas</strong> — solo diversion
          y rivalidad sana.
        </p>
      </section>

      {/* Features Section */}
      <section
        style={{
          padding: isMobile ? "48px 20px" : "64px 40px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: isMobile ? "1.75rem" : "2.25rem",
            fontWeight: 700,
            marginBottom: 16,
            color: "var(--text)",
          }}
        >
          Todo lo que necesitas para competir
        </h2>
        <p
          style={{
            textAlign: "center",
            color: "var(--muted)",
            marginBottom: 48,
            fontSize: isMobile ? "1rem" : "1.1rem",
            maxWidth: 600,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Una plataforma completa para organizar tus quinielas con amigos, familia o companeros de trabajo.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: 24,
          }}
        >
          <FeatureCard
            icon="⚽"
            title="Crea tu quiniela"
            description="Personaliza las reglas, el sistema de puntos y los plazos. Tu decides como se juega tu polla, prode o penca."
          />
          <FeatureCard
            icon="📊"
            title="Leaderboard en vivo"
            description="Ranking actualizado automaticamente despues de cada partido. Siempre sabes quien va ganando."
          />
          <FeatureCard
            icon="🎯"
            title="Predicciones flexibles"
            description="Marcador exacto, resultado, diferencia de goles. Multiples formas de sumar puntos con tus pronosticos."
          />
          <FeatureCard
            icon="👥"
            title="Invita amigos facilmente"
            description="Comparte un codigo de invitacion por WhatsApp y listo. Unite en segundos, sin complicaciones."
          />
        </div>
      </section>

      {/* How it Works (Brief) */}
      <section
        style={{
          background: "var(--surface)",
          padding: isMobile ? "60px 20px" : "80px 40px",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2
            style={{
              textAlign: "center",
              fontSize: isMobile ? "1.75rem" : "2.25rem",
              fontWeight: 700,
              marginBottom: 48,
              color: "var(--text)",
            }}
          >
            Como funciona
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
              gap: 32,
            }}
          >
            <StepCard
              number={1}
              title="Crea o unite"
              description="Crea tu propia quiniela o unite a una existente con un codigo de invitacion."
            />
            <StepCard
              number={2}
              title="Haz tus predicciones"
              description="Ingresa tus pronosticos antes del deadline de cada partido."
            />
            <StepCard
              number={3}
              title="Sube en el ranking"
              description="Gana puntos con cada acierto y demuestra que sos el mejor predictor."
            />
          </div>

          <div style={{ textAlign: "center", marginTop: 48 }}>
            <Link
              href="/como-funciona"
              style={{
                color: "var(--text)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "1rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Ver mas detalles →
            </Link>
          </div>
        </div>
      </section>

      {/* Tournament Section */}
      <section
        style={{
          padding: isMobile ? "60px 20px" : "80px 40px",
          maxWidth: 800,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? "1.75rem" : "2.25rem",
            fontWeight: 700,
            marginBottom: 16,
            color: "var(--text)",
          }}
        >
          Torneos disponibles
        </h2>
        <p
          style={{
            color: "var(--muted)",
            marginBottom: 32,
            fontSize: isMobile ? "1rem" : "1.1rem",
          }}
        >
          Crea quinielas para los torneos mas emocionantes del mundo.
        </p>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 32,
            display: "inline-block",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🏆</div>
          <h3
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: 8,
              color: "var(--text)",
            }}
          >
            Copa del Mundo 2026
          </h3>
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>
            48 equipos &bull; 104 partidos &bull; El torneo mas grande de la historia
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: isMobile ? "60px 20px" : "80px 40px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? "1.75rem" : "2.25rem",
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          Listo para demostrar que sabes de futbol?
        </h2>
        <p
          style={{
            fontSize: isMobile ? "1.1rem" : "1.25rem",
            opacity: 0.9,
            marginBottom: 12,
          }}
        >
          Unite gratis y comenza a competir con tus amigos.
        </p>
        <p
          style={{
            fontSize: isMobile ? "0.9rem" : "1rem",
            opacity: 0.75,
            marginBottom: 32,
          }}
        >
          Crea tu quiniela gratis en menos de 1 minuto.
        </p>
        <Link
          href="/login"
          style={{
            background: "white",
            color: "#764ba2",
            padding: isMobile ? "14px 28px" : "16px 32px",
            borderRadius: 8,
            fontSize: isMobile ? "1rem" : "1.1rem",
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Comenzar ahora — Es gratis
        </Link>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 28,
      }}
    >
      <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>{icon}</div>
      <h3
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          marginBottom: 8,
          color: "var(--text)",
        }}
      >
        {title}
      </h3>
      <p style={{ color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.5rem",
          fontWeight: 700,
          margin: "0 auto 16px",
        }}
      >
        {number}
      </div>
      <h3
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          marginBottom: 8,
          color: "var(--text)",
        }}
      >
        {title}
      </h3>
      <p style={{ color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        {description}
      </p>
    </div>
  );
}
