import { useState } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  // General
  {
    category: "General",
    question: "¿Qué es Picks4All?",
    answer:
      "Picks4All es una plataforma gratuita para crear y participar en quinielas deportivas con tus amigos, familia o compañeros de trabajo. Haces predicciones sobre los resultados de partidos de fútbol y compites por puntos en un leaderboard.",
  },
  {
    category: "General",
    question: "¿Es gratis usar Picks4All?",
    answer:
      "Sí, Picks4All es completamente gratis. Puedes crear pools, invitar amigos y hacer predicciones sin ningún costo.",
  },
  {
    category: "General",
    question: "¿Esto es apuestas?",
    answer:
      "No. Picks4All es una plataforma de entretenimiento donde compites por puntos y posiciones en el ranking, no por dinero. No hay apuestas ni transacciones monetarias involucradas.",
  },
  {
    category: "General",
    question: "¿Qué torneos están disponibles?",
    answer:
      "Actualmente tenemos disponible la Copa del Mundo 2026, el torneo más grande de la historia con 48 equipos y 104 partidos. Iremos agregando más torneos en el futuro.",
  },

  // Para Hosts
  {
    category: "Para Hosts",
    question: "¿Cómo creo un pool?",
    answer:
      "Después de crear tu cuenta, ve a 'Mis Pools' y haz clic en 'Crear Pool'. Elige el torneo, dale un nombre a tu pool, configura el sistema de puntos y el tiempo límite para predicciones. Una vez creado, recibirás un código de invitación para compartir.",
  },
  {
    category: "Para Hosts",
    question: "¿Puedo personalizar las reglas de puntuación?",
    answer:
      "Sí. Puedes elegir entre varios presets de puntuación o configurar los puntos para cada tipo de acierto: marcador exacto, resultado correcto (local/empate/visitante), goles del local correctos, goles del visitante correctos, y diferencia de goles.",
  },
  {
    category: "Para Hosts",
    question: "¿Cómo invito personas a mi pool?",
    answer:
      "Cada pool tiene un código de invitación único. Comparte este código por WhatsApp, email, o cualquier medio. Quien tenga el código puede unirse a tu pool después de crear su cuenta.",
  },
  {
    category: "Para Hosts",
    question: "¿Cómo publico los resultados?",
    answer:
      "Como Host, después de que termine un partido, ve al partido en tu pool y haz clic en 'Publicar Resultado'. Ingresa el marcador oficial y el leaderboard se actualizará automáticamente.",
  },
  {
    category: "Para Hosts",
    question: "¿Qué pasa si me equivoco al publicar un resultado?",
    answer:
      "Puedes corregir un resultado publicado en cualquier momento. El sistema te pedirá una razón para la corrección (errata) y actualizará los puntos automáticamente. Todas las correcciones quedan registradas para transparencia.",
  },
  {
    category: "Para Hosts",
    question: "¿Puedo nombrar co-administradores?",
    answer:
      "Sí. Puedes nombrar a otros miembros del pool como co-administradores para que te ayuden a publicar resultados. Ellos tendrán los mismos permisos que tú para administrar el pool.",
  },

  // Para Jugadores
  {
    category: "Para Jugadores",
    question: "¿Cómo me uno a un pool?",
    answer:
      "Necesitas el código de invitación que te compartió el Host. Después de crear tu cuenta o iniciar sesión, ve a 'Mis Pools' y haz clic en 'Unirse a Pool'. Ingresa el código y estarás dentro.",
  },
  {
    category: "Para Jugadores",
    question: "¿Hasta cuándo puedo hacer mis predicciones?",
    answer:
      "Cada partido tiene un deadline para predicciones, generalmente 10 minutos antes del inicio del partido (el Host puede configurar esto). Después del deadline, no podrás modificar tu predicción para ese partido.",
  },
  {
    category: "Para Jugadores",
    question: "¿Puedo cambiar mi predicción?",
    answer:
      "Sí, puedes modificar tu predicción cuantas veces quieras ANTES del deadline. Una vez que el deadline pasa, tu predicción queda bloqueada.",
  },
  {
    category: "Para Jugadores",
    question: "¿Cómo se calculan los puntos?",
    answer:
      "Los puntos se acumulan según tus aciertos. Por ejemplo, con el preset estándar: marcador exacto = 10 pts, resultado correcto = 5 pts, goles del local correctos = 2 pts, goles del visitante correctos = 2 pts, diferencia de goles = 1 pt. Si aciertas el marcador exacto, ganas puntos por todos los criterios.",
  },
  {
    category: "Para Jugadores",
    question: "¿Puedo participar en varios pools?",
    answer:
      "Sí. Puedes unirte a tantos pools como quieras, incluso del mismo torneo. Cada pool tiene su propio leaderboard y reglas.",
  },

  // Cuenta y Seguridad
  {
    category: "Cuenta",
    question: "¿Cómo creo una cuenta?",
    answer:
      "Haz clic en 'Crear cuenta gratis' e ingresa tu email, un nombre de usuario, tu nombre para mostrar y una contraseña. También puedes registrarte con tu cuenta de Google.",
  },
  {
    category: "Cuenta",
    question: "¿Qué hago si olvidé mi contraseña?",
    answer:
      "En la página de inicio de sesión, haz clic en '¿Olvidaste tu contraseña?' e ingresa tu email. Recibirás un enlace para restablecer tu contraseña.",
  },
  {
    category: "Cuenta",
    question: "¿Puedo cambiar mi nombre de usuario?",
    answer:
      "Tu nombre de usuario es único y no puede cambiarse una vez creada la cuenta. Sin embargo, puedes cambiar tu nombre para mostrar (display name) en cualquier momento desde tu perfil.",
  },
];

export function FAQPage() {
  const isMobile = useIsMobile();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  const categories = ["Todos", ...Array.from(new Set(faqData.map((item) => item.category)))];

  const filteredFAQ =
    selectedCategory === "Todos"
      ? faqData
      : faqData.filter((item) => item.category === selectedCategory);

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
          Preguntas Frecuentes
        </h1>
        <p
          style={{
            fontSize: isMobile ? "1rem" : "1.1rem",
            color: "rgba(255,255,255,0.8)",
            maxWidth: 600,
            margin: "0 auto",
          }}
        >
          Encuentra respuestas a las preguntas más comunes sobre Picks4All.
        </p>
      </section>

      {/* Category Filter */}
      <section
        style={{
          padding: isMobile ? "24px 20px" : "32px 40px",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              style={{
                padding: isMobile ? "8px 16px" : "10px 20px",
                borderRadius: 20,
                border: "none",
                background:
                  selectedCategory === category
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    : "var(--surface)",
                color: selectedCategory === category ? "white" : "var(--text)",
                fontSize: isMobile ? "0.875rem" : "0.95rem",
                fontWeight: selectedCategory === category ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow:
                  selectedCategory === category
                    ? "0 2px 8px rgba(102, 126, 234, 0.3)"
                    : "none",
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* FAQ Items */}
      <section
        style={{
          padding: isMobile ? "0 20px 60px" : "0 40px 80px",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredFAQ.map((item) => {
            const globalIndex = faqData.indexOf(item);
            const isOpen = openIndex === globalIndex;

            return (
              <div
                key={globalIndex}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  overflow: "hidden",
                  transition: "box-shadow 0.2s ease",
                  boxShadow: isOpen ? "0 4px 12px rgba(0,0,0,0.1)" : "none",
                }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : globalIndex)}
                  style={{
                    width: "100%",
                    padding: isMobile ? "16px" : "20px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      fontSize: isMobile ? "0.95rem" : "1rem",
                      fontWeight: 600,
                      color: "var(--text)",
                      flex: 1,
                    }}
                  >
                    {item.question}
                  </span>
                  <span
                    style={{
                      fontSize: "1.25rem",
                      color: "var(--muted)",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0)",
                      transition: "transform 0.2s ease",
                      flexShrink: 0,
                    }}
                  >
                    ▼
                  </span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: isMobile ? "0 16px 16px" : "0 20px 20px",
                      borderTop: "1px solid var(--border)",
                      paddingTop: 16,
                    }}
                  >
                    <p
                      style={{
                        color: "var(--muted)",
                        lineHeight: 1.7,
                        margin: 0,
                        fontSize: isMobile ? "0.9rem" : "0.95rem",
                      }}
                    >
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact Section */}
      <section
        style={{
          background: "var(--surface)",
          padding: isMobile ? "60px 20px" : "80px 40px",
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
          ¿No encontraste lo que buscabas?
        </h2>
        <p
          style={{
            color: "var(--muted)",
            marginBottom: 24,
            maxWidth: 500,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Escríbenos y te responderemos lo antes posible.
        </p>
        <a
          href="mailto:soporte@picks4all.com"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: isMobile ? "14px 28px" : "16px 32px",
            borderRadius: 8,
            fontSize: isMobile ? "1rem" : "1.1rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Contactar soporte
        </a>
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
