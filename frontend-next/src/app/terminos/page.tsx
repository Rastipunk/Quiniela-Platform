import type { Metadata } from "next";
import { TerminosContent } from "./TerminosContent";
import { Breadcrumbs } from "../../components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Terminos y Condiciones de Uso",
  description:
    "Terminos de servicio de Picks4All. Plataforma gratuita de quinielas deportivas entre amigos. Sin apuestas, sin dinero real — puro entretenimiento.",
  alternates: {
    canonical: "https://picks4all.com/terminos",
  },
};

export default function TerminosPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Inicio", url: "https://picks4all.com" },
          { name: "Terminos y Condiciones", url: "https://picks4all.com/terminos" },
        ]}
      />
      <TerminosContent />
    </>
  );
}
