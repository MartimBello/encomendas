import Link from "next/link";
import { ShieldX } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NoAccessPage() { return <main className="flex min-h-dvh items-center justify-center p-5"><Card className="max-w-md"><CardContent className="space-y-5 p-8 text-center"><ShieldX className="mx-auto size-12 text-destructive" /><div><h1 className="text-2xl font-semibold">Sem acesso a esta área</h1><p className="mt-2 text-muted-foreground">A sua conta não tem a função necessária ou ainda não foi ativada.</p></div><Button asChild variant="outline"><Link href="/">Voltar</Link></Button><form action={signOutAction}><Button variant="ghost">Terminar sessão</Button></form></CardContent></Card></main>; }
