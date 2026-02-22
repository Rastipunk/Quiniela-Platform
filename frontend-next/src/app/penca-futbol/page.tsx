import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageWrapper } from "../../components/PublicPageWrapper";
import { JsonLd } from "../../components/JsonLd";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { RegisterButton } from "../../components/RegisterButton";

export const metadata: Metadata = {
  title:
    "Penca de Futbol Gratis Online — Arma tu Penca con Amigos",
  description:
    "Crea tu penca de futbol online gratis con amigos. Hace tus predicciones, competi en el ranking y disfruta la penca como siempre se vivio en Uruguay. Sin dinero real.",
  openGraph: {
    title:
      "Penca de Futbol Gratis Online — Arma tu Penca con Amigos | Picks4All",
    description:
      "Crea tu penca de futbol online gratis con amigos. Hace tus predicciones, competi en el ranking y disfruta la penca como siempre se vivio en Uruguay. Sin dinero real.",
    url: "https://picks4all.com/penca-futbol",
    type: "article",
  },
  alternates: {
    canonical: "https://picks4all.com/penca-futbol",
  },
};

const articleStyle = {
  paragraph: {
    color: "var(--text)",
    lineHeight: 1.85,
    fontSize: "1.05rem",
    marginBottom: 24,
  } as const,
  highlight: {
    color: "var(--text)",
    fontWeight: 600 as const,
  },
  pullQuote: {
    borderLeft: "4px solid #667eea",
    paddingLeft: 24,
    margin: "32px 0",
    fontStyle: "italic" as const,
    color: "var(--muted)",
    fontSize: "1.15rem",
    lineHeight: 1.7,
  },
};

export default function PencaFutbolPage() {
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Penca de Futbol Online Gratis",
    description:
      "Todo sobre las pencas de futbol en Uruguay: historia, tradicion y como armar tu penca online gratis con amigos en Picks4All.",
    inLanguage: "es",
    datePublished: "2026-02-13",
    dateModified: "2026-02-13",
    image: "https://picks4all.com/opengraph-image",
    author: {
      "@type": "Organization",
      name: "Picks4All",
      url: "https://picks4all.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Picks4All",
      url: "https://picks4all.com",
      logo: {
        "@type": "ImageObject",
        url: "https://picks4all.com/opengraph-image",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://picks4all.com/penca-futbol",
    },
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Inicio", url: "https://picks4all.com" },
          {
            name: "Penca de Futbol",
            url: "https://picks4all.com/penca-futbol",
          },
        ]}
      />
      <JsonLd data={articleJsonLd} />
      <PublicPageWrapper>
        <div style={{ background: "var(--bg)" }}>
          {/* Hero Header */}
          <section
            className="seo-hero"
            style={{
              background:
                "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
              color: "white",
              padding: "80px 40px 60px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: "0.85rem",
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: "rgba(255,255,255,0.5)",
                marginBottom: 16,
              }}
            >
              Predicciones Deportivas
            </p>
            <h1
              className="seo-h1"
              style={{
                fontSize: "2.5rem",
                fontWeight: 800,
                marginBottom: 16,
                lineHeight: 1.2,
                maxWidth: 700,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              Penca de Futbol Online Gratis
            </h1>
            <p
              style={{
                fontSize: "1.15rem",
                color: "rgba(255,255,255,0.75)",
                maxWidth: 650,
                margin: "0 auto",
                lineHeight: 1.6,
              }}
            >
              Arma tu penca con amigos, pronostica los resultados y competi
              por el primer puesto. Gratis, desde el celular, como siempre se
              hizo en Uruguay — pero sin la planilla ni las cuentas a mano.
            </p>
          </section>

          {/* Article Body */}
          <article
            className="seo-article"
            style={{
              padding: "64px 40px",
              maxWidth: 780,
              margin: "0 auto",
            }}
          >
            {/* Section: Que es una penca */}
            <h2
              className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                color: "var(--text)",
              }}
            >
              Que es una penca?
            </h2>

            <p style={articleStyle.paragraph}>
              Si sos uruguayo, ya sabes perfectamente lo que es una{" "}
              <strong style={articleStyle.highlight}>penca</strong>. Es ese
              juego que se arma entre amigos, en la oficina o en el grupo
              familiar cada vez que arranca un torneo: cada uno pone su
              pronostico para los partidos y al final de la fecha se ve
              quien le pego a mas resultados. No hace falta ser director
              tecnico ni entender de tactica — alcanza con animarse a decir
              "Uruguay 2, Brasil 1" y bancarsela hasta el pitazo final.
            </p>

            <p style={articleStyle.paragraph}>
              Pero la{" "}
              <strong style={articleStyle.highlight}>penca de futbol</strong>{" "}
              en Uruguay es mucho mas que un pasatiempo. Es una tradicion
              que nace en el unico pais del mundo que puede decir que organizo
              y gano la{" "}
              <strong style={articleStyle.highlight}>
                primera Copa del Mundo de la historia
              </strong>
              . Fue en 1930, en el Estadio Centenario de Montevideo, cuando la
              Celeste levanto el trofeo frente a 93.000 personas. Veinte anos
              despues, en el Maracanazo de 1950, Uruguay volvio a dar la
              sorpresa del siglo al ganarle la final a Brasil en su propia
              casa. Esas dos estrellas en el escudo no son solo historia — son
              la razon por la que cada uruguayo siente que tiene derecho a
              opinar de futbol y a demostrarlo en una penca.
            </p>

            <p style={articleStyle.paragraph}>
              La penca esta presente en todos los niveles del futbol uruguayo.
              Se arman pencas para el{" "}
              <strong style={articleStyle.highlight}>
                Campeonato Uruguayo
              </strong>{" "}
              (con los clasicos Nacional vs Penarol como plato fuerte), para
              la{" "}
              <strong style={articleStyle.highlight}>Copa America</strong>,
              para las{" "}
              <strong style={articleStyle.highlight}>
                Eliminatorias Sudamericanas
              </strong>{" "}
              y, por supuesto, para la{" "}
              <strong style={articleStyle.highlight}>Copa del Mundo</strong>.
              Cuando hay futbol, hay penca. Es un ritual social que cruza
              generaciones: el abuelo que lleva decadas armandola en papel,
              los padres que la pasaron a una planilla de Excel, y los mas
              jovenes que hoy la quieren desde el celular.
            </p>

            <p style={articleStyle.paragraph}>
              A diferencia de otros paises donde se usan nombres como{" "}
              <strong style={articleStyle.highlight}>quiniela</strong>{" "}
              (Mexico), <strong style={articleStyle.highlight}>polla</strong>{" "}
              (Colombia, Chile) o{" "}
              <strong style={articleStyle.highlight}>prode</strong>{" "}
              (Argentina), en Uruguay la palabra es{" "}
              <strong style={articleStyle.highlight}>penca</strong> y no se
              negocia. Viene de la tradicion rioplatense, y esta tan
              incorporada al vocabulario cotidiano que los medios, las radios
              deportivas y hasta las empresas la usan con naturalidad: "arma
              tu penca", "la penca del Mundial", "vamos con la penca de la
              fecha".
            </p>

            {/* Section: Como funciona en Picks4All */}
            <h2
              className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                marginTop: 48,
                color: "var(--text)",
              }}
            >
              Como funciona una penca en Picks4All?
            </h2>

            <p style={articleStyle.paragraph}>
              Picks4All te permite armar tu{" "}
              <strong style={articleStyle.highlight}>
                penca online gratis
              </strong>{" "}
              en menos de dos minutos. Sin bajar ninguna app, sin pagar un
              peso, sin complicaciones. Son tres pasos y ya estas compitiendo:
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 24,
                marginBottom: 32,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <div>
                  <p
                    style={{
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: 4,
                      fontSize: "1.05rem",
                    }}
                  >
                    Crea tu penca
                  </p>
                  <p
                    style={{
                      color: "var(--muted)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    Registrate gratis, elegi el torneo (Mundial, Copa America,
                    Eliminatorias o el que quieras) y ponele nombre a tu
                    penca. Vos configuras las reglas de puntuacion y el
                    deadline.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <div>
                  <p
                    style={{
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: 4,
                      fontSize: "1.05rem",
                    }}
                  >
                    Invita a tus amigos
                  </p>
                  <p
                    style={{
                      color: "var(--muted)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    Se genera un codigo unico. Mandalo por WhatsApp, por
                    Instagram o por donde quieras. Tus amigos crean cuenta
                    gratis, ponen el codigo y ya estan adentro de la penca.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  3
                </div>
                <div>
                  <p
                    style={{
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: 4,
                      fontSize: "1.05rem",
                    }}
                  >
                    Pronostica y competi
                  </p>
                  <p
                    style={{
                      color: "var(--muted)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    Cada participante carga sus predicciones antes del
                    partido. Despues se publican los resultados y el ranking
                    se actualiza automaticamente. Nada de sumar a mano.
                  </p>
                </div>
              </div>
            </div>

            <p style={articleStyle.paragraph}>
              Eso es todo. No hay costos ocultos, no hay suscripciones, no
              hay letra chica.{" "}
              <strong style={articleStyle.highlight}>
                Picks4All es y va a seguir siendo gratis
              </strong>
              . La penca siempre fue un juego entre amigos y asi tiene que
              seguir siendo.
            </p>

            {/* Section: Por que Picks4All */}
            <h2
              className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                marginTop: 48,
                color: "var(--text)",
              }}
            >
              Por que Picks4All para tu penca?
            </h2>

            <p style={articleStyle.paragraph}>
              Toda la vida las pencas se hicieron a mano. Alguien imprimia
              una planilla con los partidos de la fecha, la repartia en la
              oficina o en el asado del domingo, y despues se pasaba horas
              sumando puntos en una hoja de calculo. Siempre habia los mismos
              problemas: alguien perdia la planilla, otro sumaba mal un
              punto, y siempre estaba el vivo que queria cambiar el
              pronostico despues de que arrancaba el partido.
            </p>

            <p style={articleStyle.paragraph}>
              Con Picks4All, todo eso se resuelve sin perder la esencia. El{" "}
              <strong style={articleStyle.highlight}>
                leaderboard se calcula automaticamente
              </strong>{" "}
              despues de cada partido — cero errores, cero discusiones. Las{" "}
              <strong style={articleStyle.highlight}>
                predicciones se bloquean solas
              </strong>{" "}
              antes del kickoff, asi que nadie puede hacer trampa. Podes
              compartir tu penca{" "}
              <strong style={articleStyle.highlight}>por WhatsApp</strong> con
              un simple codigo, y todo funciona perfecto{" "}
              <strong style={articleStyle.highlight}>desde el celular</strong>:
              carga tus pronosticos en el bondi, en la cola del super, en la
              tribuna o mientras te cevas un mate mirando la previa.
            </p>

            <p style={articleStyle.paragraph}>
              Y lo mas importante:{" "}
              <strong style={articleStyle.highlight}>
                es gratis para siempre
              </strong>
              . No hay que poner plata, no hay sorteos, no hay nada que ver
              con dinero real. Es entretenimiento puro entre amigos, como
              tiene que ser una penca.
            </p>

            {/* Pull Quote */}
            <div style={articleStyle.pullQuote}>
              "En un pais de tres millones y medio que gano dos mundiales, la
              penca no es un juego — es una forma de vida. Del Centenario al
              Maracana, del tablero de la oficina al grupo de WhatsApp, la
              penca uruguaya sigue mas viva que nunca."
            </div>

            <p style={articleStyle.paragraph}>
              La penca tiene algo que ninguna app de fantasy sports o casa de
              predicciones puede replicar: el factor personal. No compites
              contra desconocidos ni contra un algoritmo — competi contra tu
              primo que dice que sabe mas de futbol que vos, contra tu
              companera de trabajo que siempre pega los empates, contra tu
              mejor amigo que viene primero en el ranking desde la Copa
              America pasada. Esa rivalidad sana, esas cargadas despues de
              cada fecha, ese grupo de WhatsApp que explota cuando Uruguay
              mete un gol sobre la hora — eso es lo que hace especial a la
              penca. Y eso Picks4All lo preserva intacto.
            </p>

            <p style={articleStyle.paragraph}>
              Ya sea que estes armando tu penca para el proximo clasico, para
              las Eliminatorias rumbo al Mundial 2026 en Estados Unidos,
              Mexico y Canada, o para cualquier torneo que te apasione,
              Picks4All te da la herramienta para hacerlo de forma simple,
              rapida y{" "}
              <strong style={articleStyle.highlight}>
                completamente gratis
              </strong>
              . Sin dinero real. Sin sorteos. Puro entretenimiento entre
              amigos, como siempre fue la penca.
            </p>

            {/* Internal Links */}
            <div
              style={{
                marginTop: 48,
                padding: 24,
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: 12,
                  fontSize: "1rem",
                }}
              >
                Tambien te puede interesar:
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <li>
                  <Link
                    href="/que-es-una-quiniela"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                    }}
                  >
                    Que es una quiniela? Historia, origenes y nombres por pais
                  </Link>
                </li>
                <li>
                  <Link
                    href="/como-funciona"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                    }}
                  >
                    Como funciona Picks4All — Guia paso a paso
                  </Link>
                </li>
                <li>
                  <Link
                    href="/faq"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                    }}
                  >
                    Preguntas frecuentes sobre pencas y quinielas
                  </Link>
                </li>
                <li>
                  <Link
                    href="/polla-futbolera"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                    }}
                  >
                    Polla Futbolera — La quiniela colombiana y chilena
                  </Link>
                </li>
                <li>
                  <Link
                    href="/prode-deportivo"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                    }}
                  >
                    Prode Deportivo — La quiniela argentina
                  </Link>
                </li>
                <li>
                  <Link
                    href="/porra-deportiva"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontSize: "1rem",
                    }}
                  >
                    Porra Deportiva — La tradicion española
                  </Link>
                </li>
              </ul>
            </div>
          </article>

          {/* CTA */}
          <section
            className="seo-cta"
            style={{
              background:
                "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
              Arma tu penca gratis
            </h2>
            <p
              style={{
                fontSize: "1.1rem",
                color: "rgba(255,255,255,0.9)",
                marginBottom: 12,
                maxWidth: 550,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              100% gratis. Sin dinero real. Sin apuestas. Puro entretenimiento
              entre amigos.
            </p>
            <p
              style={{
                fontSize: "0.95rem",
                color: "rgba(255,255,255,0.7)",
                marginBottom: 32,
              }}
            >
              Crea tu penca en menos de 2 minutos y compartila por WhatsApp.
            </p>
            <RegisterButton />
          </section>
        </div>
      </PublicPageWrapper>
    </>
  );
}
