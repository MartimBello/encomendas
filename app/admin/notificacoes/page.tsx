import { getNotificationJobs } from "@/lib/data";
import { formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RetryNotificationsButton } from "@/components/admin-forms";
import { PageHeader } from "@/components/page-header";

export default async function NotificationsPage() { const jobs = await getNotificationJobs(); return <><PageHeader title="Entregas" description="Acompanhe emails e notificações push. Falhas transitórias são repetidas automaticamente." actions={<RetryNotificationsButton />} /><Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Canal</TableHead><TableHead>Tipo</TableHead><TableHead>Tentativas</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{jobs.map((job) => <TableRow key={job.id}><TableCell>{formatDateTime(job.created_at)}</TableCell><TableCell>{job.channel === "email" ? "Email" : "Push"}</TableCell><TableCell>{job.kind}</TableCell><TableCell>{job.attempts}</TableCell><TableCell><Badge variant={job.status === "sent" ? "accepted" : job.status === "failed" || job.status === "dead" ? "rejected" : "pending"}>{job.status}</Badge>{job.last_error && <p className="mt-1 max-w-xs truncate text-xs text-destructive">{job.last_error}</p>}</TableCell></TableRow>)}</TableBody></Table>{jobs.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Ainda não existem entregas registadas.</p>}</CardContent></Card></>; }
