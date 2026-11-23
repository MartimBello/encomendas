import "server-only";

import { weeklyMenuSchema, type WeeklyMenu } from "@/lib/weekly-menu-schema";

const DEFAULT_CENTRAL_API_BASE_URL = "https://central.olguinhas.pt";

export async function getWeeklyMenu(): Promise<WeeklyMenu> {
  const baseUrl = (process.env.CENTRAL_API_BASE_URL || DEFAULT_CENTRAL_API_BASE_URL).replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/api/ementa/menu-da-semana`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error(`A ementa central respondeu com o estado ${response.status}.`);

  const parsed = weeklyMenuSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("A ementa central devolveu dados num formato inesperado.");
  return parsed.data;
}
