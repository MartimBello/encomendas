import "server-only";

export async function nudgeNotificationWorker(limit = 20) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const workerSecret = process.env.NOTIFICATION_WORKER_SECRET;
  if (!supabaseUrl || !workerSecret) return false;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/process-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": workerSecret,
      },
      body: JSON.stringify({ limit }),
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    // The durable outbox and cron retry are the source of truth.
    return false;
  }
}
