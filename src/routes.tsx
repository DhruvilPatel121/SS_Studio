import React from "react";
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

// Public marketing
import LandingPage from "./pages/marketing/LandingPage";
import AboutPage from "./pages/marketing/AboutPage";
import ContactPage from "./pages/marketing/ContactPage";

// Auth
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";

// Photographer / Admin dashboard
import DashboardHomePage from "./pages/dashboard/DashboardHomePage";
import EventsListPage from "./pages/dashboard/EventsListPage";
import NewEventPage from "./pages/dashboard/NewEventPage";
import EventDetailPage from "./pages/dashboard/EventDetailPage";
import EditEventPage from "./pages/dashboard/EditEventPage";
import UploadPage from "./pages/dashboard/UploadPage";
import BulkUploadPage from "./pages/dashboard/BulkUploadPage";
import QRPage from "./pages/dashboard/QRPage";
import AnalyticsPage from "./pages/dashboard/AnalyticsPage";
import BrandingPage from "./pages/dashboard/BrandingPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import TeamPage from "./pages/dashboard/TeamPage";
import NotificationsPage from "./pages/dashboard/NotificationsPage";

// Super-admin
import SuperAdminUsersPage from "./pages/superadmin/SuperAdminUsersPage";
import SuperAdminPermissionsPage from "./pages/superadmin/SuperAdminPermissionsPage";
import SuperAdminEventsPage from "./pages/superadmin/SuperAdminEventsPage";
import SuperAdminJobsPage from "./pages/superadmin/SuperAdminJobsPage";
import SuperAdminAuditLogsPage from "./pages/superadmin/SuperAdminAuditLogsPage";
import SuperAdminSettingsPage from "./pages/superadmin/SuperAdminSettingsPage";

// Guest-facing (slug-based — legacy)
import EventLandingPage from "./pages/guest/EventLandingPage";
import FindMyPhotosPage from "./pages/guest/FindMyPhotosPage";
import GuestGalleryPage from "./pages/guest/GuestGalleryPage";

// Guest-facing (token-based — new dual-link system)
import PublicTokenPage from "./pages/guest/PublicTokenPage";
import PublicTokenFindPage from "./pages/guest/PublicTokenFindPage";
import PublicTokenGalleryPage from "./pages/guest/PublicTokenGalleryPage";
import PrivateTokenPage from "./pages/guest/PrivateTokenPage";

// 404
import NotFound from "./pages/NotFound";

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  // ── Root & Marketing (public) ────────────────────────────────────
  { name: "Landing", path: "/", element: <LandingPage />, public: true },
  { name: "About", path: "/about", element: <AboutPage />, public: true },
  { name: "Contact", path: "/contact", element: <ContactPage />, public: true },

  // ── Auth (public) ────────────────────────────────────────────────
  { name: "Login", path: "/login", element: <LoginPage />, public: true },
  {
    name: "Register",
    path: "/register",
    element: <RegisterPage />,
    public: true,
  },
  {
    name: "Forgot Password",
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
    public: true,
  },
  {
    name: "Reset Password",
    path: "/reset-password",
    element: <ResetPasswordPage />,
    public: true,
  },

  // ── Guest event pages — slug-based (legacy / QR backward compat) ────
  {
    name: "Event Landing",
    path: "/e/:slug",
    element: <EventLandingPage />,
    public: true,
  },
  {
    name: "Find My Photos",
    path: "/e/:slug/find",
    element: <FindMyPhotosPage />,
    public: true,
  },
  {
    name: "Guest Gallery",
    path: "/e/:slug/gallery",
    element: <GuestGalleryPage />,
    public: true,
  },

  // ── Guest event pages — token-based (new dual-link system) ──────────
  // Public token: selfie search → see only own photos
  {
    name: "Public Event",
    path: "/join/:token",
    element: <PublicTokenPage />,
    public: true,
  },
  {
    name: "Public Find",
    path: "/join/:token/find",
    element: <PublicTokenFindPage />,
    public: true,
  },
  {
    name: "Public Gallery",
    path: "/join/:token/gallery",
    element: <PublicTokenGalleryPage />,
    public: true,
  },
  // Private token: full gallery access (VIP / close family)
  {
    name: "Private Gallery",
    path: "/vip/:token",
    element: <PrivateTokenPage />,
    public: true,
  },

  // ── Dashboard (ADMIN / PHOTOGRAPHER / STAFF) ─────────────────────
  { name: "Dashboard", path: "/dashboard", element: <DashboardHomePage /> },
  { name: "Events", path: "/dashboard/events", element: <EventsListPage /> },
  {
    name: "New Event",
    path: "/dashboard/events/new",
    element: <NewEventPage />,
  },
  {
    name: "Event Detail",
    path: "/dashboard/events/:id",
    element: <EventDetailPage />,
  },
  {
    name: "Edit Event",
    path: "/dashboard/events/:id/edit",
    element: <EditEventPage />,
  },
  { name: "Upload", path: "/dashboard/upload", element: <UploadPage /> },
  {
    name: "Bulk Upload",
    path: "/dashboard/events/:id/upload",
    element: <BulkUploadPage />,
  },
  { name: "QR Codes", path: "/dashboard/qr", element: <QRPage /> },
  {
    name: "Analytics",
    path: "/dashboard/analytics",
    element: <AnalyticsPage />,
  },
  { name: "Branding", path: "/dashboard/branding", element: <BrandingPage /> },
  { name: "Team", path: "/dashboard/team", element: <TeamPage /> },
  {
    name: "Notifications",
    path: "/dashboard/notifications",
    element: <NotificationsPage />,
  },
  { name: "Settings", path: "/dashboard/settings", element: <SettingsPage /> },

  // ── Super-admin ──────────────────────────────────────────────────
  {
    name: "Super Admin",
    path: "/super-admin",
    element: <Navigate to="/super-admin/users" replace />,
  },
  {
    name: "SA Users",
    path: "/super-admin/users",
    element: <SuperAdminUsersPage />,
  },
  {
    name: "SA Permissions",
    path: "/super-admin/permissions",
    element: <SuperAdminPermissionsPage />,
  },
  {
    name: "SA Events",
    path: "/super-admin/events",
    element: <SuperAdminEventsPage />,
  },
  {
    name: "SA Jobs",
    path: "/super-admin/jobs",
    element: <SuperAdminJobsPage />,
  },
  {
    name: "SA Audit Logs",
    path: "/super-admin/audit-logs",
    element: <SuperAdminAuditLogsPage />,
  },
  {
    name: "SA Settings",
    path: "/super-admin/settings",
    element: <SuperAdminSettingsPage />,
  },

  // ── Legacy /admin redirects ──────────────────────────────────────
  {
    name: "Admin Rdr",
    path: "/admin",
    element: <Navigate to="/super-admin/users" replace />,
  },
  {
    name: "Admin Users Rdr",
    path: "/admin/users",
    element: <Navigate to="/super-admin/users" replace />,
  },
  {
    name: "Admin Events Rdr",
    path: "/admin/events",
    element: <Navigate to="/super-admin/events" replace />,
  },
  {
    name: "Admin Jobs Rdr",
    path: "/admin/jobs",
    element: <Navigate to="/super-admin/jobs" replace />,
  },

  // ── 404 ──────────────────────────────────────────────────────────
  { name: "Not Found", path: "*", element: <NotFound />, public: true },
];
