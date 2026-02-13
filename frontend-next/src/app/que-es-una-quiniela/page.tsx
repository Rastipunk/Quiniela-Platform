import type { Metadata } from "next";
import Link from "next/link";
import { PublicNavbar } from "../../components/PublicNavbar";
import { Footer } from "../../components/Footer";
import { JsonLd } from "../../components/JsonLd";

export const metadata: Metadata = {
  title:
    "Que es una Quiniela? — Polla, Prode, Penca, Porra Explicados",
  description:
    "Conoce los nombres de las quinielas deportivas en cada pais: quiniela (Mexico), polla (Colombia/Chile), prode (Argentina), penca (Uruguay) y porra (Espana).",
  openGraph: {
    title: "Que es una Quiniela? — Polla, Prode, Penca, Porra Explicados",
    description:
      "Conoce los nombres de las quinielas deportivas en cada pais: quiniela (Mexico), polla (Colombia/Chile), prode (Argentina), penca (Uruguay) y porra (Espana).",
    url: "https://picks4all.com/que-es-una-quiniela",
    type: "website",
  },
};

const termsByCountry = [
  { country: "Mexico", flag: "🇲🇽", term: "Quiniela" },
  { country: "Colombia", flag: "🇨🇴", term: "Polla" },
  { country: "Argentina", flag: "🇦🇷", term: "Prode" },
  { country: "Uruguay", flag: "🇺🇾", term: "Penca" },
  { country: "Chile", flag: "🇨🇱", term: "Polla" },
  { country: "Venezuela", flag: "🇻🇪", term: "Polla" },
  { country: "Espana", flag: "🇪🇸", term: "Porra" },
  { country: "Peru", flag: "🇵🇪", term: "Chancha / Polla" },
  { country: "Ecuador", flag: "🇪🇨", term: "Quiniela" },
  { country: "Bolivia", flag: "🇧🇴", term: "Vaquita" },
];

export default function QueEsUnaQuinielaPage() {
  // JSON-LD: DefinedTermSet schema
  const definedTermSetJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Nombres regionales de quinielas deportivas",
    description:
      "Glosario de los diferentes nombres que reciben las quinielas deportivas en paises de habla hispana",
    hasDefinedTerm: termsByCountry.map((item) => ({
      "@type": "DefinedTerm",
      name: item.term,
      description: `Nombre para quiniela deportiva en ${item.country}`,
      inDefinedTermSet: "Nombres regionales de quinielas deportivas",
    })),
  };

  // JSON-LD: FAQPage schema for the questions on this page
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Que es una quiniela deportiva?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Una quiniela deportiva es un juego de predicciones donde un grupo de amigos, familiares o companeros de trabajo intentan adivinar los resultados de partidos de futbol. Cada participante hace sus pronosticos antes de que comience el partido y gana puntos segun la precision de sus predicciones. Es una forma de entretenimiento gratuita que no involucra dinero real ni apuestas.",
        },
      },
      {
        "@type": "Question",
        name: "Cual es la diferencia entre quiniela, polla, prode y penca?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Todos se refieren al mismo concepto: un juego de predicciones deportivas entre amigos. El nombre varia segun el pais: quiniela en Mexico y Ecuador, polla en Colombia, Chile y Venezuela, prode en Argentina, penca en Uruguay, porra en Espana, chancha o polla en Peru, y vaquita en Bolivia.",
        },
      },
      {
        "@type": "Question",
        name: "Es legal jugar quinielas entre amigos?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Si. Las quinielas entre amigos son una tradicion social completamente legal cuando no se apuesta dinero real. Picks4All es una plataforma gratuita de entretenimiento — no somos un sitio de apuestas ni de juegos de azar.",
        },
      },
    ],
  };

  return (
    <>
      <JsonLd data={definedTermSetJsonLd} />
      <JsonLd data={faqJsonLd} />
      <PublicNavbar />

      <div style={{ background: "var(--bg)" }}>
        {/* Header */}
        <section
          style={{
            background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
            color: "white",
            padding: "60px 40px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              marginBottom: 12,
            }}
          >
            Que es una Quiniela?
          </h1>
          <p
            style={{
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.8)",
              maxWidth: 650,
              margin: "0 auto",
            }}
          >
            Quiniela, polla, prode, penca, porra... muchos nombres, un mismo
            juego. Conoce como se llaman las predicciones deportivas en cada pais.
          </p>
        </section>

        {/* Section 1: Que es una quiniela deportiva? */}
        <section
          style={{
            padding: "80px 40px",
            maxWidth: 800,
            margin: "0 auto",
          }}
        >
          <h2
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: 24,
              color: "var(--text)",
            }}
          >
            Que es una quiniela deportiva?
          </h2>

          <p
            style={{
              color: "var(--text)",
              lineHeight: 1.8,
              fontSize: "1.05rem",
              marginBottom: 20,
            }}
          >
            Una <strong>quiniela deportiva</strong> es un juego de predicciones
            donde un grupo de amigos, familiares o companeros de trabajo
            intentan adivinar los resultados de partidos de futbol. Cada
            participante hace sus pronosticos antes de que comience el partido y
            gana puntos segun la precision de sus predicciones.
          </p>

          <p
            style={{
              color: "var(--text)",
              lineHeight: 1.8,
              fontSize: "1.05rem",
              marginBottom: 20,
            }}
          >
            Es una tradicion que existe desde hace decadas en toda Latinoamerica
            y Espana. Antes se hacia en papel o en hojas de Excel. Hoy,
            plataformas como <strong>Picks4All</strong> permiten crear tu
            quiniela online de forma gratuita, invitar a tus amigos y llevar el
            puntaje automaticamente.
          </p>

          <p
            style={{
              color: "var(--text)",
              lineHeight: 1.8,
              fontSize: "1.05rem",
              marginBottom: 0,
            }}
          >
            Lo mejor de todo: <strong>no es apuestas</strong>. Una quiniela
            entre amigos es entretenimiento puro. Compites por el honor de ser
            el mejor predictor del grupo, no por dinero. Es la forma mas
            divertida de vivir los torneos de futbol como la Copa del Mundo 2026
            o la Champions League.
          </p>
        </section>

        {/* Section 2: Table of terms by country */}
        <section
          style={{
            background: "var(--surface)",
            padding: "80px 40px",
          }}
        >
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: 16,
                color: "var(--text)",
                textAlign: "center",
              }}
            >
              Como se llama la quiniela en cada pais?
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
              El mismo juego de predicciones deportivas tiene diferentes nombres
              segun el pais. Aqui los mas comunes:
            </p>

            <div
              style={{
                background: "var(--bg)",
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
                        padding: "16px 20px",
                        textAlign: "left",
                        fontWeight: 600,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Pais
                    </th>
                    <th
                      style={{
                        padding: "16px 20px",
                        textAlign: "left",
                        fontWeight: 600,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Nombre local
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {termsByCountry.map((item, index) => (
                    <tr key={item.country}>
                      <td
                        style={{
                          padding: "14px 20px",
                          borderBottom:
                            index < termsByCountry.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                          fontSize: "1rem",
                        }}
                      >
                        <span style={{ marginRight: 10 }}>{item.flag}</span>
                        {item.country}
                      </td>
                      <td
                        style={{
                          padding: "14px 20px",
                          borderBottom:
                            index < termsByCountry.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                          fontWeight: 600,
                          color: "#667eea",
                          fontSize: "1rem",
                        }}
                      >
                        {item.term}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 3: Differences explained */}
        <section
          style={{
            padding: "80px 40px",
            maxWidth: 800,
            margin: "0 auto",
          }}
        >
          <h2
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: 24,
              color: "var(--text)",
            }}
          >
            Cual es la diferencia entre quiniela, polla, prode y penca?
          </h2>

          <p
            style={{
              color: "var(--text)",
              lineHeight: 1.8,
              fontSize: "1.05rem",
              marginBottom: 20,
            }}
          >
            En esencia, <strong>no hay diferencia</strong>. Todos estos terminos
            se refieren al mismo concepto: un juego donde predices resultados de
            partidos de futbol y compites contra otros jugadores. La diferencia
            es puramente regional:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "20px 24px",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "#667eea",
                  marginBottom: 8,
                }}
              >
                Quiniela
              </h3>
              <p
                style={{
                  color: "var(--muted)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                Termino predominante en <strong>Mexico</strong> y{" "}
                <strong>Ecuador</strong>. Originalmente se referia a los sorteos
                de loteria, pero en el contexto deportivo se usa para cualquier
                juego de predicciones de futbol. Es el termino mas reconocido a
                nivel global en espanol.
              </p>
            </div>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "20px 24px",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "#667eea",
                  marginBottom: 8,
                }}
              >
                Polla
              </h3>
              <p
                style={{
                  color: "var(--muted)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                Usado principalmente en <strong>Colombia</strong>,{" "}
                <strong>Chile</strong>, <strong>Venezuela</strong> y{" "}
                <strong>Peru</strong>. Viene de "polla de beneficencia", un
                sistema de apuestas colectivas. En Colombia es muy comun la
                "polla mundialista" durante las Copas del Mundo.
              </p>
            </div>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "20px 24px",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "#667eea",
                  marginBottom: 8,
                }}
              >
                Prode
              </h3>
              <p
                style={{
                  color: "var(--muted)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                Abreviatura de "PROnosticos DEportivos", tipico de{" "}
                <strong>Argentina</strong>. Fue un juego oficial del gobierno
                argentino desde 1972. Hoy se usa coloquialmente para cualquier
                prediccion deportiva entre amigos.
              </p>
            </div>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "20px 24px",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "#667eea",
                  marginBottom: 8,
                }}
              >
                Penca
              </h3>
              <p
                style={{
                  color: "var(--muted)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                Predominante en <strong>Uruguay</strong>. Los uruguayos arman
                sus "pencas" para cada torneo importante. Es una tradicion muy
                arraigada en la cultura futbolera del pais.
              </p>
            </div>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "20px 24px",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "#667eea",
                  marginBottom: 8,
                }}
              >
                Porra
              </h3>
              <p
                style={{
                  color: "var(--muted)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                Usado en <strong>Espana</strong>. "Echar una porra" significa
                hacer una prediccion deportiva. Es comun en oficinas y grupos de
                amigos durante la Liga, Champions y mundiales.
              </p>
            </div>
          </div>

          <p
            style={{
              color: "var(--text)",
              lineHeight: 1.8,
              fontSize: "1.05rem",
              marginTop: 24,
            }}
          >
            En Picks4All usamos la palabra <strong>"pool"</strong> como termino
            neutral, pero no importa como lo llames en tu pais — la plataforma
            funciona igual para todos.
          </p>
        </section>

        {/* Section 4: Is it legal? */}
        <section
          style={{
            background: "var(--surface)",
            padding: "80px 40px",
          }}
        >
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: 24,
                color: "var(--text)",
              }}
            >
              Es legal jugar quinielas entre amigos?
            </h2>

            <div
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: "32px",
              }}
            >
              <p
                style={{
                  color: "var(--text)",
                  lineHeight: 1.8,
                  fontSize: "1.05rem",
                  marginBottom: 20,
                }}
              >
                <strong>Si, absolutamente.</strong> Las quinielas entre amigos
                son una tradicion social completamente legal en toda
                Latinoamerica y Espana. Picks4All es una plataforma de{" "}
                <strong>entretenimiento gratuito</strong> donde:
              </p>

              <ul
                style={{
                  color: "var(--text)",
                  lineHeight: 2,
                  fontSize: "1.05rem",
                  paddingLeft: 24,
                  marginBottom: 20,
                }}
              >
                <li>
                  <strong>No se apuesta dinero real</strong> — compites por
                  puntos y posiciones en el ranking
                </li>
                <li>
                  <strong>No hay transacciones monetarias</strong> — la
                  plataforma es 100% gratuita
                </li>
                <li>
                  <strong>No somos casa de apuestas</strong> — somos una app de
                  entretenimiento entre amigos
                </li>
                <li>
                  <strong>No hay juegos de azar</strong> — tus predicciones
                  dependen de tu conocimiento deportivo
                </li>
              </ul>

              <p
                style={{
                  color: "var(--muted)",
                  lineHeight: 1.8,
                  fontSize: "0.95rem",
                  margin: 0,
                }}
              >
                Picks4All existe para digitalizar la experiencia clasica de las
                quinielas entre amigos — la misma que se ha jugado en papel,
                pizarras y hojas de Excel durante decadas. Solo que ahora es mas
                facil, automatico y divertido.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: CTA */}
        <section
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "80px 40px",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Crea tu quiniela gratis ahora
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              opacity: 0.9,
              marginBottom: 12,
              maxWidth: 550,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            No importa si la llamas quiniela, polla, prode, penca o porra.
            Con Picks4All puedes crearla en minutos y competir con tus amigos.
          </p>
          <p
            style={{
              fontSize: "0.95rem",
              opacity: 0.75,
              marginBottom: 32,
            }}
          >
            100% gratis. Sin apuestas. Sin dinero real.
          </p>
          <Link
            href="/login"
            style={{
              background: "white",
              color: "#764ba2",
              padding: "16px 32px",
              borderRadius: 8,
              fontSize: "1.1rem",
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Crear cuenta gratis
          </Link>
        </section>
      </div>

      <Footer />
    </>
  );
}
