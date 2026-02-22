import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageWrapper } from "../../components/PublicPageWrapper";
import { JsonLd } from "../../components/JsonLd";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { RegisterButton } from "../../components/RegisterButton";

export const metadata: Metadata = {
  title:
    "Porra Deportiva Online Gratis — Crea tu Porra de Futbol con Amigos",
  description:
    "Crea tu porra deportiva online gratis con amigos. Haz predicciones de futbol, comparte por WhatsApp y compite sin dinero. La porra de futbol digital para tu pena.",
  openGraph: {
    title:
      "Porra Deportiva Online Gratis — Crea tu Porra de Futbol con Amigos | Picks4All",
    description:
      "Crea tu porra deportiva online gratis con amigos. Haz predicciones de fútbol, comparte por WhatsApp y compite sin dinero.",
    url: "https://picks4all.com/porra-deportiva",
    type: "article",
  },
  alternates: {
    canonical: "https://picks4all.com/porra-deportiva",
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

export default function PorraDeportivaPage() {
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Porra Deportiva Online Gratis — Crea tu Porra de Fútbol con Amigos",
    description:
      "Guía completa sobre las porras deportivas en España: qué son, cómo funcionan y cómo crear la tuya gratis con Picks4All.",
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
      "@id": "https://picks4all.com/porra-deportiva",
    },
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Inicio", url: "https://picks4all.com" },
          { name: "Porra Deportiva", url: "https://picks4all.com/porra-deportiva" },
        ]}
      />
      <JsonLd data={articleJsonLd} />
      <PublicPageWrapper>
      <div style={{ background: "var(--bg)" }}>
        {/* Hero Header */}
        <section
          className="seo-hero"
          style={{
            background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
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
            Porra Deportiva Online Gratis
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
            Monta tu porra de fútbol con amigos, comparte el enlace y compite
            por el título de mejor pronosticador. Sin dinero, sin complicaciones.
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
          {/* Section 1: ¿Qué es una porra deportiva? */}
          <h2
            className="seo-h2"
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              marginBottom: 20,
              color: "var(--text)",
            }}
          >
            ¿Qué es una porra deportiva?
          </h2>

          <p style={articleStyle.paragraph}>
            Si eres de España, seguro que lo has vivido más de una vez: llega un
            gran torneo de fútbol y alguien en la oficina, en el bar o en el
            grupo de WhatsApp dice{" "}
            <strong style={articleStyle.highlight}>
              &quot;¿echamos una porra?&quot;
            </strong>
            . Así de simple empieza todo. Cada uno pronostica los resultados de
            los partidos y, al final, el que más acierta se lleva la gloria (y
            el derecho a presumir hasta el próximo torneo).
          </p>

          <p style={articleStyle.paragraph}>
            La{" "}
            <strong style={articleStyle.highlight}>porra deportiva</strong> es
            una tradición profundamente española. Nació en los bares y las{" "}
            <strong style={articleStyle.highlight}>peñas deportivas</strong>{" "}
            mucho antes de que existiera internet, cuando los aficionados se
            juntaban a ver los partidos y aprovechaban para competir entre ellos
            prediciendo marcadores. La palabra &quot;porra&quot; viene de la
            costumbre de &quot;echar al bote&quot; — cada participante aportaba
            algo simbólico y los acertantes se repartían el honor. Con el
            tiempo, el dinero dejó de ser lo importante: lo que realmente
            importa es demostrar quién sabe más de fútbol.
          </p>

          <p style={articleStyle.paragraph}>
            Es importante no confundir la porra entre amigos con{" "}
            <strong style={articleStyle.highlight}>La Quiniela</strong>, el
            juego oficial del Estado español que existe desde 1946 y está
            gestionado por Loterías y Apuestas del Estado. La Quiniela es un
            producto regulado donde se juega con dinero real marcando el 1, la
            X o el 2 en quince partidos de la Liga. La porra, en cambio, es
            todo lo contrario: es{" "}
            <strong style={articleStyle.highlight}>informal, social y gratuita</strong>.
            No necesitas pagar nada — solo atreverte a dar tu pronóstico y
            aguantar las bromas cuando fallas.
          </p>

          <p style={articleStyle.paragraph}>
            Desde las peñas del Real Madrid y el Barcelona hasta las oficinas
            de cualquier ciudad española, las porras han acompañado cada Liga,
            cada Champions League y cada Copa del Mundo durante generaciones. Es
            una de esas tradiciones que todo aficionado al fútbol en España ha
            vivido al menos una vez.
          </p>

          {/* Section 2: ¿Cómo funciona una porra en Picks4All? */}
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
            ¿Cómo funciona una porra en Picks4All?
          </h2>

          <p style={articleStyle.paragraph}>
            Picks4All convierte esa tradición del bar en una experiencia digital
            limpia y sencilla. Crear tu{" "}
            <strong style={articleStyle.highlight}>porra online</strong> es
            cuestión de minutos, y tus amigos pueden unirse desde cualquier
            sitio. Así funciona:
          </p>

          {/* Step 1 */}
          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#667eea",
              marginBottom: 8,
              marginTop: 32,
            }}
          >
            1. Crea tu porra
          </h3>
          <p style={articleStyle.paragraph}>
            Regístrate gratis en Picks4All, elige el torneo que quieras seguir
            — La Liga, la Champions League, el Mundial 2026, lo que sea — y
            ponle nombre a tu porra. Puedes personalizar las reglas de
            puntuación: cuántos puntos vale acertar el marcador exacto, cuántos
            el resultado general, cuántos acertar los goles de un equipo. Tú
            decides cómo se juega en tu grupo.
          </p>

          {/* Step 2 */}
          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#667eea",
              marginBottom: 8,
              marginTop: 32,
            }}
          >
            2. Invita a tus amigos
          </h3>
          <p style={articleStyle.paragraph}>
            Comparte el código de invitación por WhatsApp, Telegram, email o
            como prefieras. Quien tenga el código puede unirse a tu porra en
            segundos. No importa si están en la misma ciudad o al otro lado del
            país — la porra digital funciona igual de bien para la peña del
            bar que para el grupo de amigos de la universidad que ya no vive en
            el mismo sitio.
          </p>

          {/* Step 3 */}
          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#667eea",
              marginBottom: 8,
              marginTop: 32,
            }}
          >
            3. Pronostica y compite
          </h3>
          <p style={articleStyle.paragraph}>
            Cada participante introduce su predicción para cada partido antes
            del cierre (normalmente diez minutos antes del pitido inicial).
            Cuando se publican los resultados, el{" "}
            <strong style={articleStyle.highlight}>
              ranking se actualiza automáticamente
            </strong>
            . Nada de hojas de Excel, nada de calculadoras, nada de discusiones
            sobre si los puntos están bien sumados. La clasificación está
            siempre al día y visible para todos los participantes.
          </p>

          {/* Section 3: ¿Por qué Picks4All para tu porra? */}
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
            ¿Por qué usar Picks4All para tu porra?
          </h2>

          <p style={articleStyle.paragraph}>
            Durante décadas, organizar una porra deportiva significaba lo
            mismo: alguien imprimía una tabla con los partidos, la pasaba por
            la oficina o la peña, y cada persona apuntaba sus pronósticos a
            boli. Luego venía la parte difícil — alguien tenía que sumar los
            puntos de cada jornada a mano o montar una hoja de cálculo que
            inevitablemente acababa desactualizada o con errores. Y si alguien
            estaba de viaje o no podía ir al bar, se quedaba sin jugar esa
            jornada.
          </p>

          <p style={articleStyle.paragraph}>
            Picks4All resuelve todo eso sin perder la esencia de la porra
            tradicional:
          </p>

          <p style={articleStyle.paragraph}>
            <strong style={articleStyle.highlight}>
              Clasificación automática.
            </strong>{" "}
            Los puntos se calculan al instante cuando se publica cada resultado.
            No hay errores, no hay discusiones, no hay voluntarios haciendo
            cuentas.{" "}
            <strong style={articleStyle.highlight}>
              Accesible desde el móvil.
            </strong>{" "}
            Haz tu pronóstico desde donde estés: en el sofá, en el metro, en
            la cola del súper. Solo necesitas el navegador.{" "}
            <strong style={articleStyle.highlight}>
              Reglas personalizables.
            </strong>{" "}
            Cada grupo es diferente. Unos valoran más el marcador exacto, otros
            la diferencia de goles. Con Picks4All puedes configurar el sistema
            de puntos como tu grupo prefiera.{" "}
            <strong style={articleStyle.highlight}>
              Gratis para siempre.
            </strong>{" "}
            Sin trucos, sin versión premium oculta para las funciones básicas.
            Crea tu porra, invita a tus amigos y competid todo el torneo sin
            pagar nada.
          </p>

          <p style={articleStyle.paragraph}>
            Y lo mejor: funciona para cualquier torneo. Tanto si es la jornada
            del sábado de La Liga como si es la final de la Champions o la fase
            de grupos del Mundial, puedes tener tu{" "}
            <strong style={articleStyle.highlight}>porra de fútbol</strong>{" "}
            siempre activa y al día.
          </p>

          {/* Pull Quote */}
          <div style={articleStyle.pullQuote}>
            &quot;La porra es esa tradición española que convierte cualquier
            partido en algo personal. No importa si es un lunes de Liga o una
            semifinal de Champions — cuando hay porra, todo el mundo tiene una
            opinión y la defiende hasta el final.&quot;
          </div>

          {/* Internal links */}
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: "28px 32px",
              marginTop: 48,
            }}
          >
            <p
              style={{
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 16,
                fontSize: "1.05rem",
              }}
            >
              También te puede interesar:
            </p>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <li>
                <Link
                  href="/que-es-una-quiniela"
                  style={{
                    color: "#667eea",
                    textDecoration: "none",
                    fontSize: "1rem",
                    fontWeight: 500,
                  }}
                >
                  ¿Qué es una quiniela? — Historia y nombres por país
                </Link>
              </li>
              <li>
                <Link
                  href="/como-funciona"
                  style={{
                    color: "#667eea",
                    textDecoration: "none",
                    fontSize: "1rem",
                    fontWeight: 500,
                  }}
                >
                  Cómo funciona Picks4All — Guía paso a paso
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  style={{
                    color: "#667eea",
                    textDecoration: "none",
                    fontSize: "1rem",
                    fontWeight: 500,
                  }}
                >
                  Preguntas frecuentes
                </Link>
              </li>
              <li>
                <Link
                  href="/polla-futbolera"
                  style={{
                    color: "#667eea",
                    textDecoration: "none",
                    fontSize: "1rem",
                    fontWeight: 500,
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
                    fontWeight: 500,
                  }}
                >
                  Prode Deportivo — La quiniela argentina
                </Link>
              </li>
              <li>
                <Link
                  href="/penca-futbol"
                  style={{
                    color: "#667eea",
                    textDecoration: "none",
                    fontSize: "1rem",
                    fontWeight: 500,
                  }}
                >
                  Penca de Futbol — Predicciones a la uruguaya
                </Link>
              </li>
            </ul>
          </div>
        </article>

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
            Crea tu porra gratis
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
            100% gratis. Sin dinero. Sin complicaciones. Puro fútbol entre
            amigos.
          </p>
          <p
            style={{
              fontSize: "0.95rem",
              color: "rgba(255,255,255,0.7)",
              marginBottom: 32,
            }}
          >
            Monta tu porra deportiva online en menos de dos minutos.
          </p>
          <RegisterButton />
        </section>
      </div>

      </PublicPageWrapper>
    </>
  );
}
