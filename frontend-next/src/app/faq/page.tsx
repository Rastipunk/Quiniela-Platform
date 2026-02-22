import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageWrapper } from "../../components/PublicPageWrapper";
import { JsonLd } from "../../components/JsonLd";
import { FAQAccordion } from "../../components/FAQAccordion";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { RegisterButton } from "../../components/RegisterButton";

export const metadata: Metadata = {
  title:
    "Preguntas Frecuentes — Quinielas, Pollas y Prodes Deportivas",
  description:
    "Que es una quiniela? Es gratis? Como funciona una polla futbolera? Todas las respuestas sobre predicciones deportivas entre amigos.",
  openGraph: {
    title: "Preguntas Frecuentes — Quinielas, Pollas y Prodes Deportivas",
    description:
      "Que es una quiniela? Es gratis? Como funciona una polla futbolera? Todas las respuestas sobre predicciones deportivas entre amigos.",
    url: "https://picks4all.com/faq",
    type: "website",
  },
  alternates: {
    canonical: "https://picks4all.com/faq",
  },
};

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  // General
  {
    category: "General",
    question: "Que es Picks4All?",
    answer:
      "Picks4All es una plataforma gratuita para crear y participar en quinielas deportivas con tus amigos, familia o companeros de trabajo. Haces predicciones sobre los resultados de partidos de futbol y compites por puntos en un leaderboard. Ya sea que la conozcas como quiniela, polla, prode, penca o porra, aqui puedes jugar gratis.",
  },
  {
    category: "General",
    question: "Es gratis usar Picks4All?",
    answer:
      "Si, Picks4All es completamente gratis. Puedes crear pools (quinielas), invitar amigos y hacer predicciones sin ningun costo. No hay planes de pago obligatorios ni cargos ocultos para la funcionalidad principal.",
  },
  {
    category: "General",
    question: "Esto es apuestas?",
    answer:
      "No. Picks4All es una plataforma de entretenimiento donde compites por puntos y posiciones en el ranking, no por dinero. No hay apuestas ni transacciones monetarias involucradas. Es simplemente una quiniela entre amigos para divertirse.",
  },
  {
    category: "General",
    question: "Que torneos estan disponibles?",
    answer:
      "Actualmente tenemos disponible la Copa del Mundo 2026, el torneo mas grande de la historia con 48 equipos y 104 partidos. Iremos agregando mas torneos en el futuro, incluyendo Champions League y ligas locales.",
  },
  {
    category: "General",
    question: "Cual es la diferencia entre quiniela, polla, prode y penca?",
    answer:
      "Todos se refieren al mismo concepto: un juego de predicciones deportivas entre amigos. El nombre cambia segun el pais: en Mexico se dice 'quiniela', en Colombia y Chile 'polla', en Argentina 'prode', en Uruguay 'penca', y en España 'porra'. Picks4All funciona para todos — no importa como lo llames en tu pais.",
  },
  {
    category: "General",
    question: "Es legal jugar quinielas entre amigos?",
    answer:
      "Si. Picks4All es una plataforma de entretenimiento gratuita donde no se apuesta dinero real. Las quinielas, pollas, prodes y pencas entre amigos son una tradicion social completamente legal. No somos un sitio de apuestas ni de juegos de azar — es pura diversion y competencia sana entre amigos.",
  },

  // Para Hosts
  {
    category: "Para Hosts",
    question: "Como creo un pool (quiniela)?",
    answer:
      "Despues de crear tu cuenta, ve a 'Mis Pools' y haz clic en 'Crear Pool'. Elige el torneo, dale un nombre a tu quiniela, configura el sistema de puntos y el tiempo limite para predicciones. Una vez creado, recibiras un codigo de invitacion para compartir.",
  },
  {
    category: "Para Hosts",
    question: "Puedo personalizar las reglas de puntuacion?",
    answer:
      "Si. Puedes elegir entre varios presets de puntuacion o configurar los puntos para cada tipo de acierto: marcador exacto, resultado correcto (local/empate/visitante), goles del local correctos, goles del visitante correctos, y diferencia de goles.",
  },
  {
    category: "Para Hosts",
    question: "Como invito personas a mi pool?",
    answer:
      "Cada pool tiene un codigo de invitacion unico. Comparte este codigo por WhatsApp, email, o cualquier medio. Quien tenga el codigo puede unirse a tu quiniela despues de crear su cuenta.",
  },
  {
    category: "Para Hosts",
    question: "Como publico los resultados?",
    answer:
      "Como Host, despues de que termine un partido, ve al partido en tu pool y haz clic en 'Publicar Resultado'. Ingresa el marcador oficial y el leaderboard se actualizara automaticamente.",
  },
  {
    category: "Para Hosts",
    question: "Que pasa si me equivoco al publicar un resultado?",
    answer:
      "Puedes corregir un resultado publicado en cualquier momento. El sistema te pedira una razon para la correccion (errata) y actualizara los puntos automaticamente. Todas las correcciones quedan registradas para transparencia.",
  },
  {
    category: "Para Hosts",
    question: "Puedo nombrar co-administradores?",
    answer:
      "Si. Puedes nombrar a otros miembros del pool como co-administradores para que te ayuden a publicar resultados. Ellos tendran los mismos permisos que tu para administrar la quiniela.",
  },

  // Para Jugadores
  {
    category: "Para Jugadores",
    question: "Como me uno a un pool?",
    answer:
      "Necesitas el codigo de invitacion que te compartio el Host. Despues de crear tu cuenta o iniciar sesion, ve a 'Mis Pools' y haz clic en 'Unirse a Pool'. Ingresa el codigo y estaras dentro de la quiniela.",
  },
  {
    category: "Para Jugadores",
    question: "Hasta cuando puedo hacer mis predicciones?",
    answer:
      "Cada partido tiene un deadline para predicciones, generalmente 10 minutos antes del inicio del partido (el Host puede configurar esto). Despues del deadline, no podras modificar tu prediccion para ese partido.",
  },
  {
    category: "Para Jugadores",
    question: "Puedo cambiar mi prediccion?",
    answer:
      "Si, puedes modificar tu prediccion cuantas veces quieras ANTES del deadline. Una vez que el deadline pasa, tu prediccion queda bloqueada.",
  },
  {
    category: "Para Jugadores",
    question: "Como se calculan los puntos?",
    answer:
      "Los puntos se acumulan segun tus aciertos. Por ejemplo, con el preset estandar: marcador exacto = 10 pts, resultado correcto = 5 pts, goles del local correctos = 2 pts, goles del visitante correctos = 2 pts, diferencia de goles = 1 pt. Si aciertas el marcador exacto, ganas puntos por todos los criterios.",
  },
  {
    category: "Para Jugadores",
    question: "Puedo participar en varios pools?",
    answer:
      "Si. Puedes unirte a tantos pools como quieras, incluso del mismo torneo. Cada quiniela tiene su propio leaderboard y reglas.",
  },

  // Cuenta y Seguridad
  {
    category: "Cuenta",
    question: "Como creo una cuenta?",
    answer:
      "Haz clic en 'Crear cuenta gratis' e ingresa tu email, un nombre de usuario, tu nombre para mostrar y una contrasena. Tambien puedes registrarte con tu cuenta de Google.",
  },
  {
    category: "Cuenta",
    question: "Que hago si olvide mi contrasena?",
    answer:
      "En la pagina de inicio de sesion, haz clic en 'Olvidaste tu contrasena?' e ingresa tu email. Recibiras un enlace para restablecer tu contrasena.",
  },
  {
    category: "Cuenta",
    question: "Puedo cambiar mi nombre de usuario?",
    answer:
      "Tu nombre de usuario es unico y no puede cambiarse una vez creada la cuenta. Sin embargo, puedes cambiar tu nombre para mostrar (display name) en cualquier momento desde tu perfil.",
  },
];

export default function FAQPage() {
  // Build JSON-LD FAQPage schema from the data
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Inicio", url: "https://picks4all.com" },
          { name: "Preguntas Frecuentes", url: "https://picks4all.com/faq" },
        ]}
      />
      <JsonLd data={faqJsonLd} />
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
            Preguntas Frecuentes
          </h1>
          <p
            style={{
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.8)",
              maxWidth: 600,
              margin: "0 auto",
            }}
          >
            Encuentra respuestas a las preguntas mas comunes sobre quinielas,
            pollas, prodes y pencas deportivas en Picks4All.
          </p>
        </section>

        {/* FAQ Accordion (client component for interactivity) */}
        <FAQAccordion faqData={faqData} />

        {/* Contact Section */}
        <section
          className="seo-section"
          style={{
            background: "var(--surface)",
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
              color: "var(--text)",
            }}
          >
            No encontraste lo que buscabas?
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
            Escribenos y te responderemos lo antes posible.
          </p>
          <a
            href="mailto:soporte@picks4all.com"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              padding: "16px 32px",
              borderRadius: 8,
              fontSize: "1.1rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Contactar soporte
          </a>
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
            Crea tu cuenta gratis y comienza a competir con tu polla, prode o penca.
          </p>
          <RegisterButton label="Crear cuenta gratis" />
        </section>
      </div>

      </PublicPageWrapper>
    </>
  );
}
