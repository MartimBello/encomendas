import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() { return <main className="flex min-h-dvh items-center justify-center p-6 text-center"><div><p className="text-6xl font-bold text-secondary">404</p><h1 className="mt-4 text-2xl font-semibold">Página não encontrada</h1><p className="mt-2 text-muted-foreground">A página pode ter sido movida ou já não existe.</p><Button asChild className="mt-6"><Link href="/">Voltar ao início</Link></Button></div></main>; }
