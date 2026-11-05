"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="flex min-h-dvh items-center justify-center p-6"><div className="max-w-md text-center"><AlertTriangle className="mx-auto mb-4 size-12 text-destructive" /><h1 className="text-2xl font-semibold">Algo correu mal</h1><p className="mt-2 text-muted-foreground">Não foi possível carregar esta área. Confirme a ligação e tente novamente.</p><Button className="mt-6" onClick={reset}>Tentar novamente</Button></div></main>; }
