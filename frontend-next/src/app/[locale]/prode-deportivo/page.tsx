import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RegisterButton } from "@/components/RegisterButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo");
  return {
    title: t("prodeDeportivo.title"),
    description: t("prodeDeportivo.description"),
    openGraph: {
      title: t("prodeDeportivo.title"),
      description: t("prodeDeportivo.description"),
      url: "https://picks4all.com/prode-deportivo",
      type: "article",
    },
    alternates: {
      canonical: "https://picks4all.com/prode-deportivo",
    },
  };
}

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

export default async function ProdeDeportivoPage() {
  const locale = await getLocale();
  if (locale !== "es") notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Prode Online Gratis — Arma tu Prode Deportivo con Amigos",
    description:
      "Historia del PRODE argentino y como armar tu prode deportivo online gratis con Picks4All. Pronosticos de futbol entre amigos sin apuestas.",
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
      "@id": "https://picks4all.com/prode-deportivo",
    },
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Inicio", url: "https://picks4all.com" },
          {
            name: "Prode Deportivo",
            url: "https://picks4all.com/prode-deportivo",
          },
        ]}
      />
      <JsonLd data={articleJsonLd} />
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
              Pronosticos Deportivos
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
              Prode Online Gratis con Amigos
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
              Arma tu propio prode deportivo online en minutos, invita a tus
              amigos y competi por el primer puesto. 100% gratis, sin dinero
              real, puro entretenimiento.
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
            {/* Que es un prode */}
            <h2 className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                color: "var(--text)",
              }}
            >
              Que es un prode?
            </h2>

            <p style={articleStyle.paragraph}>
              Si sos argentino, seguramente escuchaste la palabra{" "}
              <strong style={articleStyle.highlight}>prode</strong> toda tu vida.
              En la oficina, en la cancha, en el asado del domingo: "che,
              armamos un prode para el Mundial?" es una frase que se repite cada
              vez que arranca un torneo importante. Pero la historia detras de
              esa palabra tiene mucha mas profundidad de lo que parece a simple
              vista.
            </p>

            <p style={articleStyle.paragraph}>
              Todo empezo en{" "}
              <strong style={articleStyle.highlight}>1972</strong>, cuando el
              gobierno argentino lanzo oficialmente el{" "}
              <strong style={articleStyle.highlight}>
                PRODE (Pronosticos Deportivos)
              </strong>
              . Era un sistema estatal donde los ciudadanos iban al kiosco,
              compraban un carton impreso y marcaban sus predicciones para los
              partidos de la fecha del futbol argentino. Marcabas 1 (local), X
              (empate) o 2 (visitante) para cada encuentro. Si le pegabas a
              todos, te llevabas el pozo acumulado. Asi de simple, asi de
              adictivo.
            </p>

            <p style={articleStyle.paragraph}>
              El PRODE se convirtio rapidamente en un{" "}
              <strong style={articleStyle.highlight}>
                fenomeno social masivo
              </strong>
              . Los viernes a la tarde, las colas frente a los kioscos eran
              parte del paisaje urbano de Buenos Aires, Rosario, Cordoba, Mendoza
              y cada ciudad del interior. Los lunes, la primera conversacion en
              cualquier oficina del pais arrancaba con "como te fue en el
              prode?". No importaba si eras fanatico del futbol o apenas
              distinguias un offside de un corner — todo el mundo jugaba al
              prode. Era un ritual colectivo que cruzaba clases sociales, edades
              y niveles de conocimiento futbolero.
            </p>

            <p style={articleStyle.paragraph}>
              El PRODE oficial fue discontinuado en 1998 tras la privatizacion
              de la Loteria Nacional, pero la palabra quedo{" "}
              <strong style={articleStyle.highlight}>
                grabada a fuego en el vocabulario argentino
              </strong>
              . Hoy, mas de 50 anos despues de su creacion, cuando un grupo de
              amigos organiza predicciones para el Mundial, la Champions League
              o las Eliminatorias, lo sigue llamando "prode". La institucion
              murio, pero la tradicion es inmortal.
            </p>

            {/* Como funciona en Picks4All */}
            <h2 className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                marginTop: 48,
                color: "var(--text)",
              }}
            >
              Como funciona un prode en Picks4All?
            </h2>

            <p style={articleStyle.paragraph}>
              Armar tu{" "}
              <strong style={articleStyle.highlight}>
                prode deportivo online
              </strong>{" "}
              con Picks4All es mas facil que ir al kiosco a comprar el carton.
              No necesitas planillas, no necesitas voluntarios que sumen puntos
              a mano, y no necesitas perseguir a nadie por WhatsApp para que
              mande sus pronosticos. Todo el proceso se resuelve en tres pasos:
            </p>

            <p style={articleStyle.paragraph}>
              <strong style={articleStyle.highlight}>
                1. Crea tu prode.
              </strong>{" "}
              Registrate gratis en Picks4All (solo necesitas un email), elegi el
              torneo que quieras — Copa del Mundo 2026, Champions League, Copa
              America, lo que este disponible — y dale un nombre a tu grupo.
              Configura las reglas de puntuacion (cuantos puntos por resultado
              exacto, por acertar el ganador, por diferencia de goles) y tu
              prode queda listo para recibir jugadores.
            </p>

            <p style={articleStyle.paragraph}>
              <strong style={articleStyle.highlight}>
                2. Invita a tus amigos.
              </strong>{" "}
              Cuando creas tu prode, se genera un codigo unico. Comparti ese
              codigo por WhatsApp, por Instagram, por el grupo de la oficina,
              como vos quieras. Tus amigos se registran, ingresan el codigo y
              ya estan dentro del prode. No hay aprobaciones manuales, no hay
              esperas — entran al toque.
            </p>

            <p style={articleStyle.paragraph}>
              <strong style={articleStyle.highlight}>
                3. Pronostica y competi.
              </strong>{" "}
              Cada participante carga sus pronosticos antes de que arranque cada
              partido (el deadline suele ser 10 minutos antes del pitido
              inicial). Cuando se publica el resultado oficial, los puntos se
              calculan automaticamente y el leaderboard se actualiza al instante.
              Nada de sumar a mano, nada de discutir si un punto estaba bien
              cargado. El ranking habla solo.
            </p>

            <p style={articleStyle.paragraph}>
              Y lo mas importante: Picks4All es{" "}
              <strong style={articleStyle.highlight}>
                completamente gratis
              </strong>
              . No hay dinero real involucrado, no es un sitio de juegos de azar
              y no hay costos ocultos. Es simplemente la version digital del
              prode de toda la vida — ese que antes armabas con un carton en el
              kiosco y ahora armas desde el celular en dos minutos.
            </p>

            {/* Por que es mejor que Excel */}
            <h2 className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                marginTop: 48,
                color: "var(--text)",
              }}
            >
              Por que Picks4All es mejor que una planilla de Excel?
            </h2>

            <p style={articleStyle.paragraph}>
              Seamos honestos: todos conocemos la historia. Alguien del grupo se
              ofrece como organizador, arma una planilla de Google Sheets o
              Excel con todos los partidos, manda el link por WhatsApp y dice
              "carguen sus pronosticos antes del viernes". Las primeras dos
              fechas funcionan mas o menos bien. Para la tercera, la mitad del
              grupo no cargo nada, el organizador se canso de sumar puntos, y
              la planilla quedo abandonada en algun rincon de Google Drive.
              Organizar un prode a mano es un trabajo ingrato que siempre
              termina cayendo en una sola persona.
            </p>

            <p style={articleStyle.paragraph}>
              Picks4All elimina todos esos problemas de raiz. El{" "}
              <strong style={articleStyle.highlight}>
                leaderboard se actualiza automaticamente
              </strong>{" "}
              despues de cada partido, asi que nadie tiene que sumar puntos ni
              discutir si un resultado estaba bien cargado. La plataforma es{" "}
              <strong style={articleStyle.highlight}>mobile-friendly</strong>:
              funciona perfecto en el celular, algo que cualquiera que haya
              intentado editar una planilla de Excel desde el telefono sabe que
              es una tortura. Podes elegir entre{" "}
              <strong style={articleStyle.highlight}>
                distintas reglas de puntuacion
              </strong>{" "}
              — marcador exacto, resultado correcto, goles del local, goles
              del visitante, diferencia de goles — y el sistema se encarga de
              calcular todo.
            </p>

            <p style={articleStyle.paragraph}>
              Ademas, cada pronostico queda{" "}
              <strong style={articleStyle.highlight}>
                registrado con fecha y hora
              </strong>
              , los resultados son verificables, y si el administrador necesita
              corregir un marcador (porque se cargo mal o hubo un error), el
              sistema mantiene un historial completo de cambios. Es la
              transparencia que todo prode necesita para que no haya peleas en
              el grupo. Y lo mejor de todo: es{" "}
              <strong style={articleStyle.highlight}>
                gratis para siempre
              </strong>
              . Sin planes pagos, sin publicidad invasiva, sin letra chica.
            </p>

            {/* Pull quote */}
            <div style={articleStyle.pullQuote}>
              "El PRODE nacio en 1972 como un juego estatal, pero se transformo
              en algo mucho mas grande: una tradicion que une a generaciones
              enteras de argentinos alrededor de una pasion compartida. Del
              carton del kiosco al celular, la esencia sigue siendo la misma."
            </div>

            {/* Internal links */}
            <div
              style={{
                background: "var(--surface)",
                borderRadius: 12,
                padding: "24px 28px",
                marginTop: 48,
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
                      fontWeight: 500,
                      fontSize: "1rem",
                    }}
                  >
                    Que es una quiniela? Historia y nombres por pais
                  </Link>
                </li>
                <li>
                  <Link
                    href="/como-funciona"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontWeight: 500,
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
                      fontWeight: 500,
                      fontSize: "1rem",
                    }}
                  >
                    Preguntas frecuentes sobre quinielas y prodes
                  </Link>
                </li>
                <li>
                  <Link
                    href="/polla-futbolera"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontWeight: 500,
                      fontSize: "1rem",
                    }}
                  >
                    Polla Futbolera — La quiniela colombiana y chilena
                  </Link>
                </li>
                <li>
                  <Link
                    href="/penca-futbol"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontWeight: 500,
                      fontSize: "1rem",
                    }}
                  >
                    Penca de Futbol — Predicciones a la uruguaya
                  </Link>
                </li>
                <li>
                  <Link
                    href="/porra-deportiva"
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontWeight: 500,
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
              Arma tu prode gratis
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
              100% gratis. Sin dinero real. Sin apuestas. Puro entretenimiento.
            </p>
            <p
              style={{
                fontSize: "0.95rem",
                color: "rgba(255,255,255,0.7)",
                marginBottom: 32,
              }}
            >
              Invita a tus amigos y demostren quien sabe mas de futbol.
            </p>
            <RegisterButton />
          </section>
        </div>
      </PublicPageWrapper>
    </>
  );
}
