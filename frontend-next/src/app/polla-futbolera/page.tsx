import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageWrapper } from "../../components/PublicPageWrapper";
import { JsonLd } from "../../components/JsonLd";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { RegisterButton } from "../../components/RegisterButton";

export const metadata: Metadata = {
  title:
    "Polla Futbolera Gratis Online — Crea tu Polla Mundialista con Amigos",
  description:
    "Crea tu polla futbolera gratis online. Polla mundialista entre amigos con predicciones de futbol, leaderboard automatico y sin dinero real. 100% gratis.",
  openGraph: {
    title:
      "Polla Futbolera Gratis Online — Crea tu Polla Mundialista con Amigos | Picks4All",
    description:
      "Crea tu polla futbolera gratis online. Polla mundialista entre amigos con predicciones de futbol, leaderboard automatico y sin dinero real.",
    url: "https://picks4all.com/polla-futbolera",
    type: "article",
  },
  alternates: {
    canonical: "https://picks4all.com/polla-futbolera",
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

export default function PollaFutboleraPage() {
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "Polla Futbolera Gratis con Amigos — Crea tu Polla Mundialista Online",
    description:
      "Que es una polla futbolera, como se organiza y por que Picks4All es la mejor plataforma gratuita para armar tu polla mundialista o polla deportiva online.",
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
      "@id": "https://picks4all.com/polla-futbolera",
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿Que es una polla futbolera?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Una polla futbolera es un juego de predicciones deportivas donde un grupo de amigos, familiares o companeros de trabajo pronostican los resultados de partidos de futbol y compiten por puntos. Es una tradicion muy popular en Colombia, Chile y Venezuela. En otros paises se conoce como quiniela (Mexico), prode (Argentina) o penca (Uruguay).",
        },
      },
      {
        "@type": "Question",
        name: "¿Como crear una polla mundialista gratis en Picks4All?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Crear tu polla mundialista es muy facil: registrate gratis en Picks4All, selecciona el torneo (Mundial 2026, Champions League u otro), configura las reglas de puntuacion y comparte el codigo de invitacion con tus amigos. Todos pueden hacer predicciones desde el celular o la computadora sin pagar nada.",
        },
      },
      {
        "@type": "Question",
        name: "¿Picks4All cobra algo por crear una polla futbolera?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Picks4All es 100% gratis. No se usa dinero real, no hay costos ocultos y no es un sitio de juegos de azar. Es una plataforma de entretenimiento disenada para que grupos de amigos organicen sus pollas deportivas de forma gratuita.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cual es la diferencia entre polla futbolera y quiniela?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Son exactamente el mismo concepto con distintos nombres segun la region. En Colombia, Chile y Venezuela se dice polla futbolera o polla mundialista. En Mexico y Ecuador se usa quiniela. En Argentina la llaman prode y en Uruguay, penca. Todos se refieren a un juego de predicciones de futbol entre amigos.",
        },
      },
    ],
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Inicio", url: "https://picks4all.com" },
          {
            name: "Polla Futbolera",
            url: "https://picks4all.com/polla-futbolera",
          },
        ]}
      />
      <JsonLd data={articleJsonLd} />
      <JsonLd data={faqJsonLd} />
      <PublicPageWrapper>
        <div style={{ background: "var(--bg)" }}>
          {/* Hero Header */}
          <section className="seo-hero"
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
            <h1 className="seo-h1"
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
              Polla Futbolera Gratis con Amigos
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
              Arma tu polla mundialista online en minutos, invita a tus amigos
              y compite con predicciones de futbol. Sin dinero real, sin
              complicaciones.
            </p>
          </section>

          {/* Article Body */}
          <article
            style={{
              padding: "64px 40px",
              maxWidth: 780,
              margin: "0 auto",
            }}
          >
            {/* Section: What is a polla futbolera */}
            <h2 className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                color: "var(--text)",
              }}
            >
              ¿Que es una polla futbolera?
            </h2>

            <p style={articleStyle.paragraph}>
              En{" "}
              <strong style={articleStyle.highlight}>Colombia</strong>,{" "}
              <strong style={articleStyle.highlight}>Chile</strong> y{" "}
              <strong style={articleStyle.highlight}>Venezuela</strong>, cada
              vez que arranca un torneo de futbol importante surge la misma
              pregunta en oficinas, grupos de WhatsApp y reuniones familiares:
              "¿ya armaron la polla?". La{" "}
              <strong style={articleStyle.highlight}>polla futbolera</strong> es
              un juego de predicciones donde cada participante pronostica los
              marcadores de los partidos y acumula puntos segun la precision de
              sus resultados. Al final del torneo, quien tenga mas puntos se
              lleva el reconocimiento del grupo — y el derecho a presumir hasta
              la proxima edicion.
            </p>

            <p style={articleStyle.paragraph}>
              No se necesita ser analista deportivo ni saber de estadisticas para
              participar. La gracia de la{" "}
              <strong style={articleStyle.highlight}>polla deportiva</strong> es
              precisamente esa: el que nunca ve futbol puede ganarle al fanatico
              de toda la vida. Es un juego de intuicion, de corazonadas, de "yo
              siento que hoy ganan los de casa por 2 a 0". Eso es lo que la hace
              tan divertida y tan adictiva.
            </p>

            <p style={articleStyle.paragraph}>
              La palabra{" "}
              <strong style={articleStyle.highlight}>polla</strong> tiene raices
              en la{" "}
              <strong style={articleStyle.highlight}>
                Polla Chilena de Beneficencia
              </strong>
              , una institucion fundada en 1934 que organizaba sorteos colectivos
              con fines sociales. Con el paso de las decadas, el termino se
              extendio por toda la region andina y caribeña hasta convertirse en
              la forma natural de referirse a cualquier juego de predicciones
              entre amigos. Cuando el torneo en cuestion es una Copa del Mundo,
              la tradicion se transforma en la celebre{" "}
              <strong style={articleStyle.highlight}>polla mundialista</strong>
              : un fenomeno social que mueve a millones de personas desde Bogota
              hasta Valparaiso, desde Caracas hasta Barranquilla.
            </p>

            {/* Section: How it works in Picks4All */}
            <h2 className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                marginTop: 48,
                color: "var(--text)",
              }}
            >
              ¿Como funciona una polla en Picks4All?
            </h2>

            <p style={articleStyle.paragraph}>
              Organizar una polla futbolera siempre fue divertido, pero la
              logistica era un dolor de cabeza. Alguien tenia que imprimir la
              tabla de partidos, recoger los pronosticos de cada persona, sumar
              los puntos a mano y mantener el ranking actualizado. Con{" "}
              <strong style={articleStyle.highlight}>Picks4All</strong> todo eso
              desaparece. Asi de simple funciona:
            </p>

            <h3
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#667eea",
                marginBottom: 8,
                marginTop: 32,
              }}
            >
              1. Crea tu polla en segundos
            </h3>
            <p style={articleStyle.paragraph}>
              Registrate gratis con tu correo electronico y selecciona el torneo
              que quieras jugar: el{" "}
              <strong style={articleStyle.highlight}>Mundial 2026</strong>, la
              Champions League, la Copa America o cualquier competicion
              disponible en la plataforma. Ponle nombre a tu polla, elige el
              sistema de puntuacion que prefieras y listo — tu polla esta creada
              y lista para recibir participantes. No pagas nada, no descargas
              nada.
            </p>

            <h3
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#667eea",
                marginBottom: 8,
                marginTop: 32,
              }}
            >
              2. Invita a tus amigos con un codigo
            </h3>
            <p style={articleStyle.paragraph}>
              Picks4All genera un{" "}
              <strong style={articleStyle.highlight}>
                codigo de invitacion unico
              </strong>{" "}
              para tu polla. Envialo por WhatsApp, Telegram, correo o donde
              quieras. Tus amigos se registran gratis, ingresan el codigo y
              quedan dentro. Pueden ser 4 amigos cercanos o 60 companeros de
              trabajo — no hay limite de participantes y todos entran sin costo.
            </p>

            <h3
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#667eea",
                marginBottom: 8,
                marginTop: 32,
              }}
            >
              3. Pronostica, compite y disfruta
            </h3>
            <p style={articleStyle.paragraph}>
              Cada participante ingresa su prediccion antes de que arranque cada
              partido. Cuando el juego termina, el sistema calcula los puntos{" "}
              <strong style={articleStyle.highlight}>automaticamente</strong> y
              actualiza la tabla de posiciones al instante. Todos pueden ver el{" "}
              <strong style={articleStyle.highlight}>leaderboard</strong> desde
              su celular en cualquier momento. Cero errores de calculo, cero
              dependencia de una sola persona para mantener la polla funcionando.
            </p>

            {/* Section: Why Picks4All */}
            <h2 className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                marginTop: 48,
                color: "var(--text)",
              }}
            >
              ¿Por que usar Picks4All para tu polla?
            </h2>

            <p style={articleStyle.paragraph}>
              Las pollas en papel y en Excel tienen un problema fundamental:
              dependen de la buena voluntad de alguien que quiera encargarse de
              todo. Y cuando esa persona se cansa, la polla muere. Picks4All
              elimina ese cuello de botella porque la plataforma hace el trabajo
              pesado por ti. Estas son las ventajas concretas:
            </p>

            <p style={articleStyle.paragraph}>
              <strong style={articleStyle.highlight}>
                Leaderboard automatico.
              </strong>{" "}
              Despues de cada fecha, los puntos se calculan solos y el ranking se
              actualiza en tiempo real. Nadie tiene que sumar a mano ni
              actualizar tablas. El sistema aplica las reglas de puntuacion que
              elegiste al crear la polla y no se equivoca.
            </p>

            <p style={articleStyle.paragraph}>
              <strong style={articleStyle.highlight}>
                Optimizado para celular.
              </strong>{" "}
              La mayoria de personas hacen sus predicciones desde el telefono.
              Picks4All esta diseñado para funcionar perfecto en pantallas
              pequeñas — puedes registrar tus pronosticos desde el bus camino al
              trabajo, desde el estadio antes de que empiece el partido o desde
              la sala de tu casa.
            </p>

            <p style={articleStyle.paragraph}>
              <strong style={articleStyle.highlight}>
                Varios sistemas de puntuacion.
              </strong>{" "}
              No todos los grupos juegan igual. Algunos premian solo el resultado
              exacto, otros dan puntos por acertar al ganador. En Picks4All, el
              organizador configura las reglas al crear la polla y el sistema se
              encarga del resto. Cada grupo juega a su manera.
            </p>

            <p style={articleStyle.paragraph}>
              <strong style={articleStyle.highlight}>
                Gratis para siempre.
              </strong>{" "}
              Picks4All no cobra por crear pollas, no tiene version premium
              oculta y no usa dinero real bajo ningun concepto. Es una plataforma
              de entretenimiento gratuita, diseñada para que la polla futbolera
              siga siendo lo que siempre fue: un juego entre amigos, sin
              complicaciones y sin costos.
            </p>

            {/* Pull quote */}
            <div style={articleStyle.pullQuote}>
              "La polla futbolera es mas que predicciones y puntos — es esa
              conversacion del lunes en la oficina, el mensaje a medianoche
              cuando un resultado te salvo la jornada, la rivalidad sana con tu
              mejor amigo que jura saber mas de futbol que tu. Es una tradicion
              que une generaciones en Colombia, Chile y Venezuela."
            </div>

            {/* Internal links section */}
            <h2 className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                marginTop: 48,
                color: "var(--text)",
              }}
            >
              Tambien te puede interesar
            </h2>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <li>
                <Link
                  href="/que-es-una-quiniela"
                  style={{
                    color: "#667eea",
                    textDecoration: "none",
                    fontSize: "1.05rem",
                    fontWeight: 500,
                  }}
                >
                  ¿Que es una quiniela? — Historia, origenes y nombres por pais
                </Link>
              </li>
              <li>
                <Link
                  href="/como-funciona"
                  style={{
                    color: "#667eea",
                    textDecoration: "none",
                    fontSize: "1.05rem",
                    fontWeight: 500,
                  }}
                >
                  ¿Como funciona Picks4All? — Guia completa paso a paso
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  style={{
                    color: "#667eea",
                    textDecoration: "none",
                    fontSize: "1.05rem",
                    fontWeight: 500,
                  }}
                >
                  Preguntas frecuentes sobre pollas y predicciones deportivas
                </Link>
              </li>
            </ul>
          </article>

          {/* CTA Section */}
          <section className="seo-cta"
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              padding: "80px 40px",
              textAlign: "center",
            }}
          >
            <h2 className="seo-h2"
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              Crea tu polla futbolera gratis
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
              100% gratis. Sin dinero real. Sin apuestas.
            </p>
            <p
              style={{
                fontSize: "0.95rem",
                color: "rgba(255,255,255,0.7)",
                marginBottom: 32,
              }}
            >
              Invita a tus amigos y descubre quien es el verdadero crack del
              grupo.
            </p>
            <RegisterButton />
          </section>
        </div>
      </PublicPageWrapper>
    </>
  );
}
