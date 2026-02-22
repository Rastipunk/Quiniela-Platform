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
    title: t("footballPool.title"),
    description: t("footballPool.description"),
    openGraph: {
      title: t("footballPool.title"),
      description: t("footballPool.description"),
      url: "https://picks4all.com/en/football-pool",
      type: "article",
    },
    alternates: {
      canonical: "https://picks4all.com/en/football-pool",
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

export default async function FootballPoolPage() {
  const locale = await getLocale();
  if (locale !== "en") notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "Free Football Pool Online — Create Your Prediction Pool with Friends",
    description:
      "What is a football pool, how prediction pools work around the world, and how Picks4All makes it easy to run your own pool for free.",
    inLanguage: "en",
    datePublished: "2026-02-22",
    dateModified: "2026-02-22",
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
      "@id": "https://picks4all.com/en/football-pool",
    },
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Home", url: "https://picks4all.com/en" },
          {
            name: "Football Pool",
            url: "https://picks4all.com/en/football-pool",
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
              Sports Predictions
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
              Free Football Pool with Friends
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
              Set up your own prediction pool in minutes, invite your mates and
              compete to see who really knows the beautiful game. No real money,
              no fuss.
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
            {/* Section: What is a football pool? */}
            <h2
              className="seo-h2"
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                marginBottom: 20,
                color: "var(--text)",
              }}
            >
              What is a football pool?
            </h2>

            <p style={articleStyle.paragraph}>
              A{" "}
              <strong style={articleStyle.highlight}>football pool</strong> is a
              prediction game where a group of friends, colleagues or family
              members each forecast the results of upcoming football matches.
              Points are awarded based on accuracy — whether you predicted the
              exact score, the correct outcome, or the right goal difference —
              and a leaderboard keeps track of who is leading the pack. At the
              end of the tournament, the person with the most points earns
              bragging rights until the next competition rolls around.
            </p>

            <p style={articleStyle.paragraph}>
              The concept has deep roots in{" "}
              <strong style={articleStyle.highlight}>British culture</strong>,
              where the original football pools date back to 1923, when
              Littlewoods started selling coupons outside Old Trafford. Millions
              of people across the UK filled out their weekly pool coupons every
              Saturday, trying to predict which matches would end in score
              draws. For decades, the football pool was a national institution —
              a social ritual that connected strangers and workmates through
              their shared love of the game.
            </p>

            <p style={articleStyle.paragraph}>
              But football prediction games are far from a British invention
              alone. Across the Spanish-speaking world, the same tradition
              thrives under different names:{" "}
              <strong style={articleStyle.highlight}>quiniela</strong> in Mexico
              and Central America,{" "}
              <strong style={articleStyle.highlight}>polla</strong> in Colombia,
              Chile and Venezuela,{" "}
              <strong style={articleStyle.highlight}>prode</strong> in Argentina,{" "}
              <strong style={articleStyle.highlight}>penca</strong> in Uruguay
              and Brazil, and{" "}
              <strong style={articleStyle.highlight}>porra</strong> in Spain. In
              Brazil they also call it{" "}
              <strong style={articleStyle.highlight}>bolao</strong>. The names
              change, but the idea is universal: predict the score, compete with
              people you know, and prove that your football knowledge is
              superior.
            </p>

            <p style={articleStyle.paragraph}>
              Today, the tradition has moved online. Instead of paper coupons
              and handwritten spreadsheets, platforms like{" "}
              <strong style={articleStyle.highlight}>Picks4All</strong> let you
              create and manage your own football pool digitally — with
              automatic scoring, real-time leaderboards, and zero hassle. The
              spirit remains the same: it is about fun, friendly competition,
              and the thrill of getting your predictions right.
            </p>

            {/* Section: How it works in Picks4All */}
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
              How does a football pool work on Picks4All?
            </h2>

            <p style={articleStyle.paragraph}>
              Running a football pool used to mean someone had to volunteer as
              the organiser: printing out fixture lists, collecting predictions,
              calculating points by hand, and chasing everyone who forgot to
              submit. With{" "}
              <strong style={articleStyle.highlight}>Picks4All</strong>, all of
              that disappears. Here is how it works in three simple steps:
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
              1. Create your pool in seconds
            </h3>
            <p style={articleStyle.paragraph}>
              Sign up for free with your email and choose the tournament you
              want to play:{" "}
              <strong style={articleStyle.highlight}>World Cup 2026</strong>,
              Champions League, Copa America, or any competition available on
              the platform. Give your pool a name, pick a scoring system that
              suits your group, and you are done. Your pool is live and ready
              for participants. No downloads, no payments.
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
              2. Invite your friends with a code
            </h3>
            <p style={articleStyle.paragraph}>
              Picks4All generates a{" "}
              <strong style={articleStyle.highlight}>
                unique invitation code
              </strong>{" "}
              for your pool. Share it on WhatsApp, Telegram, email, or wherever
              your group hangs out. Your friends sign up for free, enter the
              code, and they are in. Whether it is 4 close mates or 60
              coworkers, there is no participant limit and everyone joins at no
              cost.
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
              3. Predict, compete and enjoy
            </h3>
            <p style={articleStyle.paragraph}>
              Each participant submits their prediction before the match kicks
              off (the deadline is typically ten minutes before the start).
              Once the result is published, the system calculates points{" "}
              <strong style={articleStyle.highlight}>automatically</strong> and
              updates the leaderboard instantly. Everyone can check the{" "}
              <strong style={articleStyle.highlight}>standings</strong> from
              their phone at any time. No calculation errors, no dependency on
              one person to keep the pool running.
            </p>

            {/* Section: Why Picks4All */}
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
              Why use Picks4All for your football pool?
            </h2>

            <p style={articleStyle.paragraph}>
              Excel spreadsheets and group chats have one fundamental problem:
              they depend on someone volunteering to do all the boring work.
              And when that person gets tired, the pool dies. Picks4All removes
              that bottleneck because the platform does the heavy lifting for
              you. Here is what makes it different:
            </p>

            <p style={articleStyle.paragraph}>
              <strong style={articleStyle.highlight}>
                Automatic leaderboard.
              </strong>{" "}
              After every match, points are calculated automatically and the
              rankings update in real time. Nobody has to add up scores
              manually. The system applies the scoring rules you chose when
              creating the pool and does not make mistakes.
            </p>

            <p style={articleStyle.paragraph}>
              <strong style={articleStyle.highlight}>
                Mobile-first design.
              </strong>{" "}
              Most people make their predictions on their phone. Picks4All is
              built to work perfectly on small screens — submit your picks on
              the bus, at the stadium before kick-off, or from your sofa during
              the pre-match build-up.
            </p>

            <p style={articleStyle.paragraph}>
              <strong style={articleStyle.highlight}>
                Multiple scoring systems.
              </strong>{" "}
              Not every group plays the same way. Some only reward exact scores,
              others give points for guessing the winner or the goal difference.
              With Picks4All, the pool creator configures the rules and the
              system handles the rest. Each group plays their way.
            </p>

            <p style={articleStyle.paragraph}>
              <strong style={articleStyle.highlight}>
                Free forever.
              </strong>{" "}
              Picks4All does not charge to create pools, has no hidden premium
              tier, and does not involve real money in any way. It is a free
              entertainment platform, designed so that the football pool
              remains what it has always been: a game among friends, with no
              complications and no costs.
            </p>

            {/* Pull quote */}
            <div style={articleStyle.pullQuote}>
              &quot;The football pool is more than predictions and points — it
              is the Monday morning office debate, the late-night message when
              an unexpected result saves your weekend, the friendly rivalry
              with your best mate who swears they know more about football
              than you. It is a tradition that connects generations across
              countries and cultures.&quot;
            </div>

            {/* A global tradition section */}
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
              A global tradition, many names
            </h2>

            <p style={articleStyle.paragraph}>
              What English speakers call a{" "}
              <strong style={articleStyle.highlight}>football pool</strong> or{" "}
              <strong style={articleStyle.highlight}>prediction pool</strong>{" "}
              goes by dozens of names around the world. In Mexico and across
              Central America, it is a{" "}
              <strong style={articleStyle.highlight}>quiniela</strong>. In
              Colombia, Chile and Venezuela, friends organise a{" "}
              <strong style={articleStyle.highlight}>polla futbolera</strong>.
              Argentinians run a{" "}
              <strong style={articleStyle.highlight}>prode</strong> (short for
              &quot;Pronosticos Deportivos&quot;, a state-run prediction game
              from 1972). Uruguayans set up a{" "}
              <strong style={articleStyle.highlight}>penca</strong>, while
              Spaniards call it a{" "}
              <strong style={articleStyle.highlight}>porra deportiva</strong>.
              In Brazil, the same game is known as a{" "}
              <strong style={articleStyle.highlight}>penca</strong> or{" "}
              <strong style={articleStyle.highlight}>bolao</strong>.
            </p>

            <p style={articleStyle.paragraph}>
              Picks4All is built for all of these communities. Whether you
              landed on this page searching for &quot;football pool&quot;,
              &quot;quiniela online&quot;, &quot;polla futbolera gratis&quot;
              or &quot;penca de futebol&quot;, the experience is the same: a
              free, hassle-free platform where you create your prediction pool,
              invite your people, and let the system handle the rest. Football
              is a global language, and so is the joy of predicting who wins.
            </p>

            {/* Internal links section */}
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
                You might also like:
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
                    What is a quiniela? History, origins and names by country
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
                    How Picks4All works — Step-by-step guide
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
                    Frequently asked questions
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
                    Polla Futbolera — The Colombian and Chilean pool tradition
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
                    Prode Deportivo — The Argentine prediction game
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
                    Penca de Futbol — Uruguayan-style predictions
                  </Link>
                </li>
              </ul>
            </div>
          </article>

          {/* CTA Section */}
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
              Create your free football pool
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
              100% free. No real money. No gambling. Pure entertainment.
            </p>
            <p
              style={{
                fontSize: "0.95rem",
                color: "rgba(255,255,255,0.7)",
                marginBottom: 32,
              }}
            >
              Invite your friends and find out who truly knows the beautiful
              game.
            </p>
            <RegisterButton />
          </section>
        </div>
      </PublicPageWrapper>
    </>
  );
}
