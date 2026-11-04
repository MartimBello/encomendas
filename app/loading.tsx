import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() { return <div className="space-y-5"><Skeleton className="h-10 w-64" /><Skeleton className="h-24 w-full" /><div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-52" /><Skeleton className="h-52" /></div></div>; }
