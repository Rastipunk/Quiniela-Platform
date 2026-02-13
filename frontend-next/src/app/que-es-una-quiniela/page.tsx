import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageWrapper } from "../../components/PublicPageWrapper";
import { JsonLd } from "../../components/JsonLd";

export const metadata: Metadata = {
  title:
    "¿Qué es una Quiniela? — Historia, Orígenes y Nombres por País",
  description:
    "La historia de las quinielas deportivas: desde las porras españolas del siglo XIX hasta las pollas mundialistas, el prode argentino y las pencas uruguayas. Cómo un juego de amigos conquistó todo un continente.",
  openGraph: {
    title: "¿Qué es una Quiniela? — Historia, Orígenes y Nombres por País",
    description:
      "La historia de las quinielas deportivas: desde las porras españolas del siglo XIX hasta las pollas mundialistas, el prode argentino y las pencas uruguayas.",
    url: "https://picks4all.com/que-es-una-quiniela",
    type: "article",
  },
};

const termsByCountry = [
  { country: "México", flag: "🇲🇽", term: "Quiniela", origin: "Del latín quinella (combinación de cinco)" },
  { country: "Colombia", flag: "🇨🇴", term: "Polla", origin: "De 'polla de beneficencia'" },
  { country: "Argentina", flag: "🇦🇷", term: "Prode", origin: "Acrónimo de PROnósticos DEportivos" },
  { country: "Uruguay", flag: "🇺🇾", term: "Penca", origin: "Del guaraní, tradición rioplatense" },
  { country: "Chile", flag: "🇨🇱", term: "Polla", origin: "De la Polla Chilena de Beneficencia" },
  { country: "Venezuela", flag: "🇻🇪", term: "Polla", origin: "Influencia colombiana y caribeña" },
  { country: "España", flag: "🇪🇸", term: "Porra / Quiniela", origin: "Tradición de apuestas colectivas" },
  { country: "Perú", flag: "🇵🇪", term: "Polla / Chancha", origin: "'Chancha' = colecta entre amigos" },
  { country: "Ecuador", flag: "🇪🇨", term: "Quiniela", origin: "Influencia mexicana" },
  { country: "Bolivia", flag: "🇧🇴", term: "Vaquita", origin: "'Poner la vaquita' = aportar al pozo" },
];

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

export default function QueEsUnaQuinielaPage() {
  const definedTermSetJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Nombres regionales de quinielas deportivas",
    description:
      "Glosario de los diferentes nombres que reciben las quinielas deportivas en países de habla hispana",
    hasDefinedTerm: termsByCountry.map((item) => ({
      "@type": "DefinedTerm",
      name: item.term,
      description: `Nombre para quiniela deportiva en ${item.country}`,
      inDefinedTermSet: "Nombres regionales de quinielas deportivas",
    })),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "¿Qué es una quiniela deportiva?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Una quiniela deportiva es un juego de predicciones donde un grupo de amigos, familiares o compañeros de trabajo intentan adivinar los resultados de partidos de fútbol. Cada participante hace sus pronósticos antes de que comience el partido y gana puntos según la precisión de sus predicciones. Es una tradición social que existe desde hace más de un siglo en el mundo hispanohablante.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cuál es la diferencia entre quiniela, polla, prode y penca?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Todos se refieren al mismo concepto: un juego de predicciones deportivas entre amigos. El nombre varía según el país: quiniela en México y Ecuador, polla en Colombia, Chile y Venezuela, prode en Argentina, penca en Uruguay, porra en España, chancha o polla en Perú, y vaquita en Bolivia. Cada término tiene su propia historia y origen etimológico.",
        },
      },
      {
        "@type": "Question",
        name: "¿Es legal jugar quinielas entre amigos?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sí. Las quinielas entre amigos son una tradición social completamente legal cuando no se apuesta dinero real. Picks4All es una plataforma gratuita de entretenimiento — no es un sitio de apuestas ni de juegos de azar.",
        },
      },
    ],
  };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "¿Qué es una Quiniela? Historia, Orígenes y Nombres por País",
    description: "La historia de las quinielas deportivas en el mundo hispanohablante",
    inLanguage: "es",
    publisher: {
      "@type": "Organization",
      name: "Picks4All",
      url: "https://picks4all.com",
    },
  };

  return (
    <>
      <JsonLd data={definedTermSetJsonLd} />
      <JsonLd data={faqJsonLd} />
      <JsonLd data={articleJsonLd} />
      <PublicPageWrapper>
      <div style={{ background: "var(--bg)" }}>
        {/* Article Header */}
        <section
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
            Cultura Deportiva
          </p>
          <h1
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
            ¿Qué es una Quiniela Deportiva?
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
            Quiniela, polla, prode, penca, porra — la tradición que une a
            millones de aficionados al fútbol en todo el mundo hispanohablante.
            Esta es su historia.
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
          {/* Intro */}
          <p style={articleStyle.paragraph}>
            Cada cuatro años, cuando llega la Copa del Mundo, ocurre un fenómeno
            que se repite en oficinas, grupos de WhatsApp y reuniones familiares
            de toda Latinoamérica y España: alguien propone{" "}
            <strong style={articleStyle.highlight}>armar la quiniela</strong>.
            Aunque depende del país donde te encuentres, es posible que la llamen{" "}
            <strong style={articleStyle.highlight}>polla</strong>,{" "}
            <strong style={articleStyle.highlight}>prode</strong>,{" "}
            <strong style={articleStyle.highlight}>penca</strong> o{" "}
            <strong style={articleStyle.highlight}>porra</strong>. El nombre
            cambia, pero la esencia es la misma: predecir resultados de fútbol y
            competir entre amigos por el honor de ser el que más sabe.
          </p>

          <p style={articleStyle.paragraph}>
            Se trata de una de las tradiciones sociales más arraigadas en el
            mundo del fútbol. No requiere conocimiento táctico profundo ni
            entender formaciones — basta con atreverse a decir "2 a 1" y esperar
            los 90 minutos. Es entretenimiento puro, y durante décadas se ha
            jugado en papel, pizarras de oficina y hojas de cálculo
            interminables.
          </p>

          <div style={articleStyle.pullQuote}>
            "La quiniela es ese raro espacio donde el fanático casual y el
            analista táctico compiten en igualdad de condiciones. Todos tienen
            una opinión sobre el próximo partido, y eso es lo que la hace
            especial."
          </div>

          {/* Origins */}
          <h2
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              marginBottom: 20,
              marginTop: 48,
              color: "var(--text)",
            }}
          >
            Los orígenes: de las apuestas colectivas al juego entre amigos
          </h2>

          <p style={articleStyle.paragraph}>
            La historia de las predicciones deportivas organizadas se remonta al
            siglo XIX en Europa. En{" "}
            <strong style={articleStyle.highlight}>España</strong>, las{" "}
            <strong style={articleStyle.highlight}>porras</strong> — colectas
            informales donde cada participante aportaba una cantidad simbólica y
            apostaba por un resultado — ya eran tradición en tabernas y peñas
            deportivas antes de que el fútbol se profesionalizara. La palabra
            "porra" viene precisamente de esa costumbre de "echar al pozo" y
            repartir entre los acertantes.
          </p>

          <p style={articleStyle.paragraph}>
            El término{" "}
            <strong style={articleStyle.highlight}>quiniela</strong>, por su
            parte, tiene raíces en el latín{" "}
            <em>quinella</em> (una combinación de cinco elementos) y se
            popularizó primero en el contexto de la lotería. En 1946, España
            lanzó oficialmente{" "}
            <strong style={articleStyle.highlight}>La Quiniela</strong>, un
            juego estatal donde los participantes predecían los resultados de 15
            partidos de fútbol marcando 1 (local), X (empate) o 2 (visitante).
            Fue un éxito inmediato y se convirtió en ritual de cada fin de
            semana para millones de españoles.
          </p>

          <p style={articleStyle.paragraph}>
            Ese modelo cruzó el Atlántico y se adaptó de formas muy diversas en
            cada país latinoamericano, adquiriendo nombres propios y matices
            culturales únicos.
          </p>

          {/* Regional Deep Dive */}
          <h2
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              marginBottom: 20,
              marginTop: 48,
              color: "var(--text)",
            }}
          >
            Un juego, muchos nombres: el mapa de las quinielas en Latinoamérica
          </h2>

          <p style={articleStyle.paragraph}>
            Lo fascinante de esta tradición es cómo cada país la hizo suya. No
            solo cambiaron el nombre — en muchos casos crearon instituciones
            oficiales alrededor del concepto.
          </p>

          {/* Prode - Argentina */}
          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#667eea",
              marginBottom: 8,
              marginTop: 32,
            }}
          >
            🇦🇷 El Prode argentino: cuando el gobierno oficializó el juego
          </h3>
          <p style={articleStyle.paragraph}>
            En 1972, el gobierno argentino creó el{" "}
            <strong style={articleStyle.highlight}>
              PRODE (Pronósticos Deportivos)
            </strong>
            , un sistema oficial donde los ciudadanos compraban cartones y
            predecían resultados de la liga local. Fue un fenómeno social
            masivo: los lunes, la conversación en cualquier oficina de Buenos
            Aires empezaba con "¿cómo te fue en el prode?". Aunque el PRODE
            oficial fue discontinuado, la palabra quedó grabada en el vocabulario
            argentino. Hoy, cuando un grupo de amigos en Argentina organiza
            predicciones para el Mundial, lo siguen llamando{" "}
            <strong style={articleStyle.highlight}>prode</strong>.
          </p>

          {/* Polla - Colombia/Chile */}
          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#667eea",
              marginBottom: 8,
              marginTop: 32,
            }}
          >
            🇨🇴🇨🇱 La polla: de la beneficencia a la pasión mundialista
          </h3>
          <p style={articleStyle.paragraph}>
            En <strong style={articleStyle.highlight}>Colombia</strong>,{" "}
            <strong style={articleStyle.highlight}>Chile</strong> y{" "}
            <strong style={articleStyle.highlight}>Venezuela</strong>, el
            término dominante es{" "}
            <strong style={articleStyle.highlight}>polla</strong>. Su origen se
            encuentra en la{" "}
            <em>Polla Chilena de Beneficencia</em>, creada en 1934 como un
            sistema de apuestas colectivas cuyas ganancias se destinaban a obras
            sociales. La palabra se exportó a toda la región y hoy es sinónimo
            de quiniela deportiva. En Colombia, la expresión{" "}
            <strong style={articleStyle.highlight}>
              "polla mundialista"
            </strong>{" "}
            se activa cada cuatro años como un reloj: desde la empresa más
            grande hasta el grupo de amigos del barrio, todo el mundo arma su
            polla.
          </p>

          {/* Penca - Uruguay */}
          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#667eea",
              marginBottom: 8,
              marginTop: 32,
            }}
          >
            🇺🇾 La penca uruguaya: tradición rioplatense
          </h3>
          <p style={articleStyle.paragraph}>
            En <strong style={articleStyle.highlight}>Uruguay</strong>, nadie
            dice quiniela ni polla — se dice{" "}
            <strong style={articleStyle.highlight}>penca</strong>. La tradición
            de las pencas está profundamente ligada a la cultura futbolera del
            país que vio nacer la primera Copa del Mundo en 1930. Los uruguayos
            arman pencas para todo: el Campeonato Uruguayo, la Copa América, el
            Mundial, e incluso las Eliminatorias. Es un ritual social que
            trasciende generaciones.
          </p>

          {/* Porra - España */}
          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#667eea",
              marginBottom: 8,
              marginTop: 32,
            }}
          >
            🇪🇸 La porra española: del bar a la oficina
          </h3>
          <p style={articleStyle.paragraph}>
            Mientras que en España{" "}
            <strong style={articleStyle.highlight}>La Quiniela</strong> es el
            juego oficial del estado, entre amigos se usa más la palabra{" "}
            <strong style={articleStyle.highlight}>porra</strong>. "Echar una
            porra" significa organizar predicciones informales, generalmente en
            el trabajo o en la peña del bar. Durante la Liga, la Champions
            League y cada Mundial, las porras se multiplican. Es una tradición
            tan antigua como el fútbol español.
          </p>

          {/* Others */}
          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#667eea",
              marginBottom: 8,
              marginTop: 32,
            }}
          >
            🇧🇴🇵🇪 La vaquita y la chancha: los nombres más creativos
          </h3>
          <p style={articleStyle.paragraph}>
            En <strong style={articleStyle.highlight}>Bolivia</strong> se la
            conoce como{" "}
            <strong style={articleStyle.highlight}>vaquita</strong> — "poner la
            vaquita" significa contribuir al pozo común, una expresión que nace
            de las colectas informales. En{" "}
            <strong style={articleStyle.highlight}>Perú</strong>, además de
            "polla", se usa{" "}
            <strong style={articleStyle.highlight}>chancha</strong>, que también
            se refiere a juntar dinero entre un grupo. Y en{" "}
            <strong style={articleStyle.highlight}>México</strong> y{" "}
            <strong style={articleStyle.highlight}>Ecuador</strong>, el término{" "}
            <strong style={articleStyle.highlight}>quiniela</strong> reina
            absoluto, con una cultura especialmente fuerte durante los mundiales
            y la Liga MX.
          </p>
        </article>

        {/* Country Table */}
        <section
          style={{
            background: "var(--surface)",
            padding: "64px 40px",
          }}
        >
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <h2
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 12,
                color: "var(--text)",
                textAlign: "center",
              }}
            >
              Guía rápida: ¿cómo se dice en tu país?
            </h2>
            <p
              style={{
                textAlign: "center",
                color: "var(--muted)",
                marginBottom: 32,
                maxWidth: 550,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              Diez países, diez maneras de llamar al mismo juego.
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
                        padding: "14px 20px",
                        textAlign: "left",
                        fontWeight: 600,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      País
                    </th>
                    <th
                      style={{
                        padding: "14px 20px",
                        textAlign: "left",
                        fontWeight: 600,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Nombre
                    </th>
                    <th
                      style={{
                        padding: "14px 20px",
                        textAlign: "left",
                        fontWeight: 600,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Origen
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {termsByCountry.map((item, index) => (
                    <tr key={item.country}>
                      <td
                        style={{
                          padding: "12px 20px",
                          borderBottom:
                            index < termsByCountry.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                        }}
                      >
                        <span style={{ marginRight: 8 }}>{item.flag}</span>
                        {item.country}
                      </td>
                      <td
                        style={{
                          padding: "12px 20px",
                          borderBottom:
                            index < termsByCountry.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                          fontWeight: 600,
                          color: "#667eea",
                        }}
                      >
                        {item.term}
                      </td>
                      <td
                        style={{
                          padding: "12px 20px",
                          borderBottom:
                            index < termsByCountry.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                          color: "var(--muted)",
                          fontSize: "0.9rem",
                        }}
                      >
                        {item.origin}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Digital Evolution */}
        <article
          style={{
            padding: "64px 40px",
            maxWidth: 780,
            margin: "0 auto",
          }}
        >
          <h2
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              marginBottom: 20,
              color: "var(--text)",
            }}
          >
            Del papel a la pantalla: la evolución digital
          </h2>

          <p style={articleStyle.paragraph}>
            Durante décadas, organizar una quiniela significaba lo mismo en todos
            los países: alguien imprimía una tabla con los partidos, la pasaba
            por la oficina, y cada persona anotaba sus pronósticos a mano.
            Después venía lo difícil — calcular los puntos. Siempre había
            alguien con una hoja de Excel heroica que intentaba mantener el
            leaderboard actualizado, y siempre había discusiones sobre si un
            punto estaba bien sumado.
          </p>

          <p style={articleStyle.paragraph}>
            Hoy, plataformas como{" "}
            <strong style={articleStyle.highlight}>Picks4All</strong>{" "}
            digitalizan toda esa experiencia: crear tu quiniela (o polla,
            prode, penca — como quieras llamarla), invitar amigos con un código,
            hacer predicciones desde el celular y tener el ranking actualizado
            automáticamente después de cada partido. La esencia del juego sigue
            siendo exactamente la misma que hace 50 años. Solo que ahora es más
            fácil, más rápido, y sin errores de cálculo.
          </p>

          <div style={articleStyle.pullQuote}>
            "Lo que antes requería una hoja de cálculo y un voluntario muy
            paciente, hoy se resuelve en 2 minutos desde el celular."
          </div>

          <h2
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              marginBottom: 20,
              marginTop: 48,
              color: "var(--text)",
            }}
          >
            ¿Por qué la quiniela sigue siendo tan popular?
          </h2>

          <p style={articleStyle.paragraph}>
            En un mundo con apps de apuestas, fantasy sports y estadísticas
            avanzadas, la quiniela entre amigos sigue siendo imbatible por una
            razón simple: <strong style={articleStyle.highlight}>es personal</strong>.
            No compites contra desconocidos ni contra algoritmos — compites
            contra tu cuñado que dice que sabe más de fútbol, contra tu
            compañera de trabajo que siempre acierta los empates, contra tu
            mejor amigo que lleva ganando tres mundiales seguidos.
          </p>

          <p style={articleStyle.paragraph}>
            Eso es algo que ninguna casa de apuestas puede replicar: la
            rivalidad sana, las cargadas cuando fallas, el grupo de WhatsApp que
            explota después de un resultado inesperado. La quiniela convierte
            cada partido en algo personal, y eso la mantiene viva generación
            tras generación.
          </p>
        </article>

        {/* CTA */}
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
            Crea tu quiniela gratis
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
            No importa si la llamas quiniela, polla, prode, penca o porra.
            Con Picks4All puedes crearla en minutos y competir con tus amigos.
          </p>
          <p
            style={{
              fontSize: "0.95rem",
              color: "rgba(255,255,255,0.7)",
              marginBottom: 32,
            }}
          >
            100% gratis. Puro entretenimiento entre amigos.
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

      </PublicPageWrapper>
    </>
  );
}
