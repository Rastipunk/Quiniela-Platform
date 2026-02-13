import type { Metadata } from "next";
import { PrivacidadContent } from "./PrivacidadContent";
import { Breadcrumbs } from "../../components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Politica de Privacidad",
  description:
    "Politica de privacidad de Picks4All. Como protegemos tus datos en nuestra plataforma de quinielas deportivas gratuita.",
  alternates: {
    canonical: "https://picks4all.com/privacidad",
  },
};

export default function PrivacidadPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Inicio", url: "https://picks4all.com" },
          { name: "Politica de Privacidad", url: "https://picks4all.com/privacidad" },
        ]}
      />
      <PrivacidadContent />
    </>
  );
}
