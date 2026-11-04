"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  async function install() {
    if (!prompt) return setHelpOpen(true);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setPrompt(null);
  }

  return <>
    <Button type="button" variant="outline" size="sm" onClick={install}><Download /> Instalar app</Button>
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Instalar Encomendas</DialogTitle>
          <DialogDescription>Abra esta página num browser compatível. No iPad, a instalação no ecrã principal é necessária para notificações em segundo plano.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-muted p-4 text-sm leading-relaxed"><Share className="mb-2 size-5 text-primary" /><strong>Safari no iPad:</strong> toque em Partilhar e depois em “Adicionar ao ecrã principal”.<br /><br /><strong>Chrome no Android:</strong> abra o menu do browser e escolha “Instalar aplicação”.</div>
        <DialogFooter><Button onClick={() => setHelpOpen(false)}>Percebi</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
