import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { photosApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HardDrive, AlertTriangle, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function StudioQuotaMeter() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['studio-media-quota', user?.id, user?.studio_name],
    queryFn: () => photosApi.getStudioMediaStats(),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  if (isSuperAdmin) {
    return null; // Super Admin has global views
  }

  if (isLoading) {
    return (
      <Card className="mb-8 border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardContent className="p-5">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const quotaLimit = stats?.quota_limit ?? 25000;
  const activeCount = stats?.active_media_count ?? 0;
  const remaining = stats?.remaining_capacity ?? (quotaLimit - activeCount);
  const percent = Math.min(100, Math.max(0, stats?.percentage_used ?? ((activeCount / quotaLimit) * 100)));
  const isWarning = percent >= 80 && percent < 100;
  const isExceeded = percent >= 100;

  let progressColor = 'bg-accent';
  let badgeVariant: 'default' | 'outline' | 'destructive' = 'default';
  let statusText = 'Optimal Capacity';

  if (isExceeded) {
    progressColor = 'bg-destructive';
    badgeVariant = 'destructive';
    statusText = 'Quota Reached';
  } else if (isWarning) {
    progressColor = 'bg-amber-500';
    badgeVariant = 'outline';
    statusText = 'High Capacity';
  }

  return (
    <Card className="mb-8 border border-border/70 shadow-sm bg-card/70 backdrop-blur-sm relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-accent/5 to-transparent pointer-events-none" />

      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-editorial flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-accent" />
            Media Storage Quota — {user?.studio_name || 'Studio'}
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Combined photo & video capacity granted by Super Admin. Deleting media immediately releases capacity.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={badgeVariant}
            className={`text-[11px] font-medium flex items-center gap-1 ${
              isWarning ? 'border-amber-500/40 text-amber-500 bg-amber-500/10' : ''
            }`}
          >
            {isExceeded ? (
              <AlertTriangle className="h-3 w-3" />
            ) : isWarning ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <CheckCircle2 className="h-3 w-3 text-accent" />
            )}
            {statusText}
          </Badge>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Refresh quota stats"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Progress Bar Container */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">
              {activeCount.toLocaleString()}{' '}
              <span className="text-muted-foreground font-normal">
                / {quotaLimit.toLocaleString()} media items stored
              </span>
            </span>
            <span className="font-mono text-muted-foreground font-medium">
              {percent.toFixed(1)}% used
            </span>
          </div>

          <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden p-0.5 ring-1 ring-border/50">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${Math.max(1, percent)}%` }}
            />
          </div>
        </div>

        {/* Footer info pill */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40 gap-2">
          <p className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="font-medium text-foreground">
              {remaining.toLocaleString()}
            </span>{' '}
            photo & video slots remaining available to upload.
          </p>

          <p className="text-[11px] text-muted-foreground/80 italic">
            Quota auto-managed: deletes reduce count; uploads enforce limit.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}