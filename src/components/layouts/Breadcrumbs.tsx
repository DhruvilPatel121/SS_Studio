import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronRight, Home, Shield, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CrumbItem {
  label: string;
  path?: string;
}

const ROUTE_MAP: Record<string, CrumbItem[]> = {
  // Super Admin routes
  '/super-admin': [
    { label: 'Super Admin', path: '/super-admin/users' },
    { label: 'Dashboard' },
  ],
  '/super-admin/users': [
    { label: 'Super Admin', path: '/super-admin/users' },
    { label: 'Studio Admins & Organizations' },
  ],
  '/super-admin/permissions': [
    { label: 'Super Admin', path: '/super-admin/users' },
    { label: 'Permissions & Roles Matrix' },
  ],
  '/super-admin/events': [
    { label: 'Super Admin', path: '/super-admin/users' },
    { label: 'All Platform Events' },
  ],
  '/super-admin/jobs': [
    { label: 'Super Admin', path: '/super-admin/users' },
    { label: 'Processing & AI Jobs' },
  ],
  '/super-admin/audit-logs': [
    { label: 'Super Admin', path: '/super-admin/users' },
    { label: 'System Audit Logs' },
  ],
  '/super-admin/settings': [
    { label: 'Super Admin', path: '/super-admin/users' },
    { label: 'Global Platform Settings' },
  ],

  // Studio Admin routes
  '/dashboard': [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Studio Overview' },
  ],
  '/dashboard/events': [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Events' },
  ],
  '/dashboard/events/new': [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Events', path: '/dashboard/events' },
    { label: 'Create New Event' },
  ],
  '/dashboard/upload': [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Upload Media' },
  ],
  '/dashboard/qr': [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Event QR Codes' },
  ],
  '/dashboard/analytics': [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Analytics & Insights' },
  ],
  '/dashboard/branding': [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Studio Branding & Watermarks' },
  ],
  '/dashboard/team': [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Studio Team & Roles' },
  ],
  '/dashboard/settings': [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Studio Settings' },
  ],
  '/dashboard/notifications': [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Notifications' },
  ],
};

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  // Find exact match or match prefix
  let crumbs: CrumbItem[] = ROUTE_MAP[pathname] ?? [];
  if (crumbs.length === 0) {
    if (pathname.startsWith('/dashboard/events/')) {
      crumbs = [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Events', path: '/dashboard/events' },
        { label: 'Event Details' },
      ];
    } else if (pathname.startsWith('/super-admin/')) {
      crumbs = [
        { label: 'Super Admin', path: '/super-admin/users' },
        { label: pathname.replace('/super-admin/', '').replace('-', ' ') },
      ];
    } else if (pathname.startsWith('/dashboard/')) {
      crumbs = [
        { label: 'Dashboard', path: '/dashboard' },
        { label: pathname.replace('/dashboard/', '').replace('-', ' ') },
      ];
    }
  }

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <nav
      aria-label="Breadcrumbs"
      className="border-b border-border/50 bg-card/40 backdrop-blur-md px-4 md:px-6 py-2.5 text-xs flex items-center justify-between text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-all shrink-0"
    >
      <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap min-w-0 pr-2">
        <Link
          to={isSuperAdmin ? '/super-admin/users' : '/dashboard'}
          className="flex items-center gap-1 hover:text-foreground transition-colors font-medium shrink-0"
        >
          {isSuperAdmin ? (
            <Shield className="h-3.5 w-3.5 text-accent" />
          ) : (
            <Home className="h-3.5 w-3.5 text-accent" />
          )}
          <span>{isSuperAdmin ? 'SuperAdmin' : 'Studio'}</span>
        </Link>

        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <React.Fragment key={idx}>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              {crumb.path && !isLast ? (
                <Link
                  to={crumb.path}
                  className="hover:text-foreground transition-colors capitalize shrink-0"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-semibold text-foreground capitalize truncate">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        {isSuperAdmin ? (
          <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider bg-accent/10 border-accent/20 text-accent font-medium">
            Super Admin Authority
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] font-mono bg-muted/50 border-border text-muted-foreground">
            {user?.studio_name || 'Studio Admin'}
          </Badge>
        )}
      </div>
    </nav>
  );
}