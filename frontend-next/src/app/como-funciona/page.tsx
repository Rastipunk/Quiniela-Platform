import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageWrapper } from "../../components/PublicPageWrapper";
import { JsonLd } from "../../components/JsonLd";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { RegisterButton } from "../../components/RegisterButton";

export const metadata: Metadata = {
  title: "Como Crear tu Quiniela (Polla, Prode) en 3 Pasos — Gratis",
  description:
    "Aprende a crear una quiniela deportiva online, invitar amigos y competir con predicciones de futbol. Gratis, facil y sin apuestas.",
  openGraph: {
    title: "Como Crear tu Quiniela (Polla, Prode) en 3 Pasos — Gratis",
    description:
      "Aprende a crear una quiniela deportiva online, invitar amigos y competir con predicciones de futbol. Gratis, facil y sin apuestas.",
    url: "https://picks4all.com/como-funciona",
    type: "website",
  },
  alternates: {
    canonical: "https://picks4all.com/como-funciona",
  },
};

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

export default function ComoFuncionaPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Inicio", url: "https://picks4all.com" },
          { name: "Como Funciona", url: "https://picks4all.com/como-funciona" },
        ]}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "Como crear una quiniela deportiva gratis",
          description:
            "Guia paso a paso para crear tu quiniela, polla, prode o penca deportiva online con Picks4All. Invita amigos y compite prediciendo resultados de futbol.",
          step: [
            {
              "@type": "HowToStep",
              position: 1,
              name: "Crea tu cuenta",
              text: "Registrate gratis con tu email o Google. Solo toma unos segundos.",
            },
            {
              "@type": "HowToStep",
              position: 2,
              name: "Crea tu pool (quiniela)",
              text: "Elige el torneo, ponle nombre a tu pool y configura las reglas de puntuacion.",
            },
            {
              "@type": "HowToStep",
              position: 3,
              name: "Invita a tus amigos",
              text: "Comparte el codigo de invitacion por WhatsApp, email o donde quieras.",
            },
            {
              "@type": "HowToStep",
              position: 4,
              name: "Publica los resultados",
              text: "Ingresa el marcador oficial despues de cada partido. El leaderboard se actualiza automaticamente.",
            },
            {
              "@type": "HowToStep",
              position: 5,
              name: "Disfruta la competencia",
              text: "Observa como sube y baja el ranking entre tus amigos.",
            },
          ],
          tool: {
            "@type": "HowToTool",
            name: "Picks4All - Plataforma de quinielas deportivas",
          },
        }}
      />
      <PublicPageWrapper>
      <div style={{ background: "var(--bg)" }}>
        {/* Header */}
        <section
          className="seo-hero"
          style={{
            background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
            color: "white",
            padding: "60px 40px",
            textAlign: "center",
          }}
        >
          <h1
            className="seo-h1"
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              marginBottom: 12,
            }}
          >
            Como Funciona
          </h1>
          <p
            style={{
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.8)",
              maxWidth: 600,
              margin: "0 auto",
            }}
          >
            Aprende a usar Picks4All en minutos y comienza a competir con tus amigos.
            Ya sea que la conozcas como quiniela, polla, prode, penca o porra,
            aqui te explicamos como funciona.
          </p>
        </section>

        {/* For Hosts */}
        <section
          className="seo-section"
          style={{
            padding: "80px 40px",
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <h2
            className="seo-h2"
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: 32,
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                width: 40,
                height: 40,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              {"👑"}
            </span>
            Si quieres crear una quiniela (Host)
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <StepItem
              number={1}
              title="Crea tu cuenta"
              description="Registrate gratis con tu email o Google. Solo toma unos segundos."
            />
            <StepItem
              number={2}
              title="Crea tu pool (quiniela, polla o prode)"
              description="Elige el torneo (ej: Copa del Mundo 2026), ponle nombre a tu pool y configura las reglas: sistema de puntos, deadline antes de cada partido, etc."
            />
            <StepItem
              number={3}
              title="Invita a tus amigos"
              description="Genera un codigo de invitacion y compartelo por WhatsApp, email o donde quieras. Quien tenga el codigo puede unirse a tu quiniela."
            />
            <StepItem
              number={4}
              title="Publica los resultados"
              description="Despues de cada partido, ingresa el marcador oficial. El leaderboard se actualiza automaticamente."
            />
            <StepItem
              number={5}
              title="Disfruta la competencia"
              description="Observa como sube y baja el ranking. Nombra co-admins si necesitas ayuda para administrar tu polla o quiniela."
            />
          </div>
        </section>

        {/* For Players */}
        <section
          className="seo-section"
          style={{
            background: "var(--surface)",
            padding: "80px 40px",
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <h2
              className="seo-h2"
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: 32,
                color: "var(--text)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "white",
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                }}
              >
                {"⚽"}
              </span>
              Si quieres unirte a un pool (Jugador)
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <StepItem
                number={1}
                title="Recibe el codigo de invitacion"
                description="Tu amigo (el Host) te compartira un codigo unico para unirte a su quiniela, polla o prode."
              />
              <StepItem
                number={2}
                title="Crea tu cuenta y unete"
                description="Registrate si aun no tienes cuenta, luego ingresa el codigo para unirte al pool."
              />
              <StepItem
                number={3}
                title="Haz tus predicciones"
                description="Para cada partido, ingresa tu pronostico antes del deadline (generalmente 10 minutos antes del partido)."
              />
              <StepItem
                number={4}
                title="Gana puntos"
                description="Cuando se publiquen los resultados, ganaras puntos segun tus aciertos: marcador exacto, resultado correcto, diferencia de goles, etc."
              />
              <StepItem
                number={5}
                title="Sube en el ranking"
                description="Sigue tu posicion en el leaderboard y demuestra que eres el mejor predictor del grupo. Compite en tu penca, quiniela o porra entre amigos."
              />
            </div>
          </div>
        </section>

        {/* Scoring System */}
        <section
          className="seo-section"
          style={{
            padding: "80px 40px",
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <h2
            className="seo-h2"
            style={{
              fontSize: "2rem",
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
            El Host puede personalizar el sistema de puntos de la quiniela. Aqui hay un ejemplo tipico:
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
                fontSize: "1rem",
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
                    <span aria-hidden="true">{"🎯"}</span> Marcador exacto (ej: 2-1)
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
                    <span aria-hidden="true">{"✅"}</span> Resultado correcto (Local/Empate/Visitante)
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
                    <span aria-hidden="true">{"🏠"}</span> Goles del local correctos
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
                    <span aria-hidden="true">{"✈️"}</span> Goles del visitante correctos
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
                    <span aria-hidden="true">{"➗"}</span> Diferencia de goles correcta
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
          className="seo-cta"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "80px 40px",
            textAlign: "center",
          }}
        >
          <h2
            className="seo-h2"
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Listo para empezar tu quiniela?
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.9)",
              marginBottom: 32,
            }}
          >
            Crea tu cuenta gratis y comienza a competir. Arma tu polla, prode o penca en minutos.
          </p>
          <RegisterButton label="Crear cuenta gratis" />
        </section>
      </div>

      </PublicPageWrapper>
    </>
  );
}
