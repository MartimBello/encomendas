"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintControls({ paper, onPaperChange }: { paper: "a4" | "80mm"; onPaperChange: (paper: "a4" | "80mm") => void }) { function choose(next: "a4" | "80mm") { localStorage.setItem("encomendas:paper", next); onPaperChange(next); } return <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4"><div className="flex gap-2"><Button variant={paper === "a4" ? "default" : "outline"} onClick={() => choose("a4")}>A4</Button><Button variant={paper === "80mm" ? "default" : "outline"} onClick={() => choose("80mm")}>80 mm</Button></div><Button size="lg" onClick={() => window.print()}><Printer /> Imprimir</Button></div>; }
