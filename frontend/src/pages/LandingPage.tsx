import { Link } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import { useAuthPanel } from "../contexts/AuthPanelContext";

export function LandingPage() {
  const isMobile = useIsMobile();
  const { openAuthPanel } = useAuthPanel();

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
              marginBottom: 20,
              lineHeight: 1.2,
            }}
          >
            Compite con tus amigos prediciendo partidos de fútbol
          </h1>
          <p
            style={{
              fontSize: isMobile ? "1.1rem" : "1.25rem",
              color: "rgba(255,255,255,0.8)",
              marginBottom: 40,
              lineHeight: 1.6,
            }}
          >
            Crea tu pool, invita a quien quieras, y descubre quién es el mejor predictor.
            Sin apuestas, solo entretenimiento puro.
          </p>
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => openAuthPanel("register")}
              style={{
                background: "white",
                color: "#1a1a1a",
                padding: isMobile ? "14px 28px" : "16px 32px",
                borderRadius: 8,
                fontSize: isMobile ? "1rem" : "1.1rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              Crear cuenta gratis
            </button>
            <Link
              to="/how-it-works"
              style={{
                background: "transparent",
                color: "white",
                border: "2px solid rgba(255,255,255,0.5)",
                padding: isMobile ? "12px 26px" : "14px 30px",
                borderRadius: 8,
                fontSize: isMobile ? "1rem" : "1.1rem",
                fontWeight: 600,
                textDecoration: "none",
                transition: "border-color 0.2s ease",
              }}
            >
              Ver cómo funciona
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        style={{
          padding: isMobile ? "60px 20px" : "80px 40px",
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
          Una plataforma completa para organizar tus quinielas con amigos, familia o compañeros de trabajo.
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
            title="Crea tu pool"
            description="Personaliza las reglas, el sistema de puntos y los plazos. Tú decides cómo se juega."
          />
          <FeatureCard
            icon="📊"
            title="Leaderboard en vivo"
            description="Ranking actualizado automáticamente después de cada partido. Siempre sabes quién va ganando."
          />
          <FeatureCard
            icon="🎯"
            title="Predicciones flexibles"
            description="Marcador exacto, resultado, diferencia de goles. Múltiples formas de sumar puntos."
          />
          <FeatureCard
            icon="👥"
            title="Invita amigos fácilmente"
            description="Comparte un código de invitación y listo. Únete en segundos, sin complicaciones."
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
            Cómo funciona
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
              title="Crea o únete"
              description="Crea tu propio pool o únete a uno existente con un código de invitación."
            />
            <StepCard
              number={2}
              title="Haz tus predicciones"
              description="Ingresa tus pronósticos antes del deadline de cada partido."
            />
            <StepCard
              number={3}
              title="Sube en el ranking"
              description="Gana puntos con cada acierto y demuestra que eres el mejor predictor."
            />
          </div>

          <div style={{ textAlign: "center", marginTop: 48 }}>
            <Link
              to="/how-it-works"
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
              Ver más detalles →
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
          Crea pools para los torneos más emocionantes del mundo.
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
            48 equipos • 104 partidos • El torneo más grande de la historia
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
          ¿Listo para demostrar que sabes de fútbol?
        </h2>
        <p
          style={{
            fontSize: isMobile ? "1.1rem" : "1.25rem",
            opacity: 0.9,
            marginBottom: 32,
          }}
        >
          Únete gratis y comienza a competir con tus amigos.
        </p>
        <button
          onClick={() => openAuthPanel("register")}
          style={{
            background: "white",
            color: "#764ba2",
            padding: isMobile ? "14px 28px" : "16px 32px",
            borderRadius: 8,
            fontSize: isMobile ? "1rem" : "1.1rem",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            display: "inline-block",
          }}
        >
          Comenzar ahora - Es gratis
        </button>
      </section>
    </div>
  );
}

// Feature Card Component
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
        transition: "box-shadow 0.2s ease",
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
      <p
        style={{
          color: "var(--muted)",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  );
}

// Step Card Component
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
      <p
        style={{
          color: "var(--muted)",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  );
}
