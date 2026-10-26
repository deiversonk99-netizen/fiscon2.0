import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GM BIM · Projetos & Soluções',
  description: 'Portal de aprovação de projetos e fiscalização de obras. Versão local de desenvolvimento.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
