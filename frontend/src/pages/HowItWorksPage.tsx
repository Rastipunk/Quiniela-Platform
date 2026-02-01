import { Link } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";

export function HowItWorksPage() {
  const isMobile = useIsMobile();

  return (
    <div style={{ background: "var(--bg)" }}>
      {/* Header */}
      <section
        style={{
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
          color: "white",
          padding: isMobile ? "40px 20px" : "60px 40px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: isMobile ? "2rem" : "2.5rem",
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          Cómo Funciona
        </h1>
        <p
          style={{
            fontSize: isMobile ? "1rem" : "1.1rem",
            color: "rgba(255,255,255,0.8)",
            maxWidth: 600,
            margin: "0 auto",
          }}
        >
          Aprende a usar Picks4All en minutos y comienza a competir con tus amigos.
        </p>
      </section>

      {/* For Hosts */}
      <section
        style={{
          padding: isMobile ? "60px 20px" : "80px 40px",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? "1.5rem" : "2rem",
            fontWeight: 700,
            marginBottom: 32,
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              width: 40,
              height: 40,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.25rem",
            }}
          >
            👑
          </span>
          Si quieres crear un pool (Host)
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <StepItem
            number={1}
            title="Crea tu cuenta"
            description="Regístrate gratis con tu email o Google. Solo toma unos segundos."
          />
          <StepItem
            number={2}
            title="Crea tu pool"
            description="Elige el torneo (ej: Copa del Mundo 2026), ponle nombre a tu pool y configura las reglas: sistema de puntos, deadline antes de cada partido, etc."
          />
          <StepItem
            number={3}
            title="Invita a tus amigos"
            description="Genera un código de invitación y compártelo por WhatsApp, email o donde quieras. Quien tenga el código puede unirse."
          />
          <StepItem
            number={4}
            title="Publica los resultados"
            description="Después de cada partido, ingresa el marcador oficial. El leaderboard se actualiza automáticamente."
          />
          <StepItem
            number={5}
            title="Disfruta la competencia"
            description="Observa cómo sube y baja el ranking. Nombra co-admins si necesitas ayuda para administrar."
          />
        </div>
      </section>

      {/* For Players */}
      <section
        style={{
          background: "var(--surface)",
          padding: isMobile ? "60px 20px" : "80px 40px",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: isMobile ? "1.5rem" : "2rem",
              fontWeight: 700,
              marginBottom: 32,
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "white",
                width: 40,
                height: 40,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              ⚽
            </span>
            Si quieres unirte a un pool (Jugador)
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <StepItem
              number={1}
              title="Recibe el código de invitación"
              description="Tu amigo (el Host) te compartirá un código único para unirte a su pool."
            />
            <StepItem
              number={2}
              title="Crea tu cuenta y únete"
              description="Regístrate si aún no tienes cuenta, luego ingresa el código para unirte al pool."
            />
            <StepItem
              number={3}
              title="Haz tus predicciones"
              description="Para cada partido, ingresa tu pronóstico antes del deadline (generalmente 10 minutos antes del partido)."
            />
            <StepItem
              number={4}
              title="Gana puntos"
              description="Cuando se publiquen los resultados, ganarás puntos según tus aciertos: marcador exacto, resultado correcto, diferencia de goles, etc."
            />
            <StepItem
              number={5}
              title="Sube en el ranking"
              description="Sigue tu posición en el leaderboard y demuestra que eres el mejor predictor del grupo."
            />
          </div>
        </div>
      </section>

      {/* Scoring System */}
      <section
        style={{
          padding: isMobile ? "60px 20px" : "80px 40px",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? "1.5rem" : "2rem",
            fontWeight: 700,
            marginBottom: 16,
            color: "var(--text)",
            textAlign: "center",
          }}
        >
          Sistema de Puntos
        </h2>
        <p
          style={{
            textAlign: "center",
            color: "var(--muted)",
            marginBottom: 32,
            maxWidth: 600,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          El Host puede personalizar el sistema de puntos. Aquí hay un ejemplo típico:
        </p>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: isMobile ? "0.9rem" : "1rem",
            }}
          >
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th
                  style={{
                    padding: "16px",
                    textAlign: "left",
                    fontWeight: 600,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  Tipo de acierto
                </th>
                <th
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    fontWeight: 600,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  Puntos
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
                  🎯 Marcador exacto (ej: 2-1)
                </td>
                <td
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    fontWeight: 700,
                    borderBottom: "1px solid var(--border)",
                    color: "#10b981",
                  }}
                >
                  10 pts
                </td>
              </tr>
              <tr>
                <td style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
                  ✅ Resultado correcto (Local/Empate/Visitante)
                </td>
                <td
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    fontWeight: 700,
                    borderBottom: "1px solid var(--border)",
                    color: "#10b981",
                  }}
                >
                  5 pts
                </td>
              </tr>
              <tr>
                <td style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
                  🏠 Goles del local correctos
                </td>
                <td
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    fontWeight: 700,
                    borderBottom: "1px solid var(--border)",
                    color: "#10b981",
                  }}
                >
                  2 pts
                </td>
              </tr>
              <tr>
                <td style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
                  ✈️ Goles del visitante correctos
                </td>
                <td
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    fontWeight: 700,
                    borderBottom: "1px solid var(--border)",
                    color: "#10b981",
                  }}
                >
                  2 pts
                </td>
              </tr>
              <tr>
                <td style={{ padding: "16px" }}>
                  ➗ Diferencia de goles correcta
                </td>
                <td
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#10b981",
                  }}
                >
                  1 pt
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p
          style={{
            textAlign: "center",
            color: "var(--muted)",
            marginTop: 16,
            fontSize: "0.9rem",
          }}
        >
          * Los puntos se acumulan. Si aciertas el marcador exacto, ganas puntos por todos los criterios.
        </p>
      </section>

      {/* CTA */}
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
            fontSize: isMobile ? "1.5rem" : "2rem",
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          ¿Listo para empezar?
        </h2>
        <p
          style={{
            fontSize: isMobile ? "1rem" : "1.1rem",
            opacity: 0.9,
            marginBottom: 32,
          }}
        >
          Crea tu cuenta gratis y comienza a competir.
        </p>
        <Link
          to="/login"
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
          Crear cuenta gratis
        </Link>
      </section>
    </div>
  );
}

// Step Item Component
function StepItem({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: "2px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1rem",
          fontWeight: 700,
          color: "var(--text)",
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <div>
        <h3
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            marginBottom: 4,
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
    </div>
  );
}
