import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fluxo CRM — Seu próximo negócio começa aqui",
  description: "Leads, pipelines, atendimento e automações no mesmo workspace comercial.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
