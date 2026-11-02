import React, { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Shield,
  CheckCircle2,
  Lock,
  Save,
  RefreshCw,
  KeyRound,
  Info,
} from "lucide-react";

interface PermissionRule {
  id: string;
  name: string;
  category: string;
  description: string;
  roles: {
    SUPER_ADMIN: boolean;
    ADMIN: boolean;
    PHOTOGRAPHER: boolean;
    STAFF: boolean;
    GUEST: boolean;
  };
}

const DEFAULT_MATRIX: PermissionRule[] = [
  {
    id: "manage_users",
    name: "Manage System Users & Roles",
    category: "Administration",
    description:
      "Create, update, suspend, or delete admins, photographers, and staff accounts.",
    roles: {
      SUPER_ADMIN: true,
      ADMIN: false,
      PHOTOGRAPHER: false,
      STAFF: false,
      GUEST: false,
    },
  },
  {
    id: "manage_permissions",
    name: "Manage Roles & Permissions",
    category: "Administration",
    description:
      "Configure and update platform permission matrices and access levels.",
    roles: {
      SUPER_ADMIN: true,
      ADMIN: false,
      PHOTOGRAPHER: false,
      STAFF: false,
      GUEST: false,
    },
  },
  {
    id: "view_audit_logs",
    name: "View Security Audit Logs",
    category: "Administration",
    description:
      "Inspect platform audit logs, security events, and user activity records.",
    roles: {
      SUPER_ADMIN: true,
      ADMIN: false,
      PHOTOGRAPHER: false,
      STAFF: false,
      GUEST: false,
    },
  },
  {
    id: "create_events",
    name: "Create & Manage Events",
    category: "Event Operations",
    description:
      "Set up new events, generate dual links (QR & VIP), and configure venues.",
    roles: {
      SUPER_ADMIN: true,
      ADMIN: true,
      PHOTOGRAPHER: true,
      STAFF: false,
      GUEST: false,
    },
  },
  {
    id: "upload_photos",
    name: "Upload & Process Photos",
    category: "Event Operations",
    description:
      "Upload high-resolution event photographs with automatic face detection.",
    roles: {
      SUPER_ADMIN: true,
      ADMIN: true,
      PHOTOGRAPHER: true,
      STAFF: true,
      GUEST: false,
    },
  },
  {
    id: "delete_photos",
    name: "Delete Event Photos",
    category: "Event Operations",
    description:
      "Remove photo assets and purge face embedding records from events.",
    roles: {
      SUPER_ADMIN: true,
      ADMIN: true,
      PHOTOGRAPHER: false,
      STAFF: false,
      GUEST: false,
    },
  },
  {
    id: "manage_branding",
    name: "Configure Watermarks & Branding",
    category: "Studio Customization",
    description:
      "Set custom text or logo watermarks, opacity levels, and color themes.",
    roles: {
      SUPER_ADMIN: true,
      ADMIN: true,
      PHOTOGRAPHER: false,
      STAFF: false,
      GUEST: false,
    },
  },
  {
    id: "view_analytics",
    name: "View Event Analytics & Traffic",
    category: "Studio Customization",
    description:
      "Track selfie uploads, guest search counts, ZIP downloads, and match metrics.",
    roles: {
      SUPER_ADMIN: true,
      ADMIN: true,
      PHOTOGRAPHER: true,
      STAFF: false,
      GUEST: false,
    },
  },
  {
    id: "export_google_drive",
    name: "Export to Google Drive",
    category: "Guest Access & Storage",
    description:
      "Allow exporting matched photos into connected Google Drive folders.",
    roles: {
      SUPER_ADMIN: true,
      ADMIN: true,
      PHOTOGRAPHER: true,
      STAFF: false,
      GUEST: true,
    },
  },
  {
    id: "batch_zip_download",
    name: "Batch ZIP Photo Download",
    category: "Guest Access & Storage",
    description:
      "Generate selective or bulk ZIP downloads with watermarking options.",
    roles: {
      SUPER_ADMIN: true,
      ADMIN: true,
      PHOTOGRAPHER: true,
      STAFF: false,
      GUEST: true,
    },
  },
  {
    id: "face_recognition_search",
    name: "AI Facial Recognition Search",
    category: "Guest Access & Storage",
    description:
      "Upload selfies to execute instant facial matching without full gallery exposure.",
    roles: {
      SUPER_ADMIN: true,
      ADMIN: true,
      PHOTOGRAPHER: true,
      STAFF: true,
      GUEST: true,
    },
  },
];

export default function SuperAdminPermissionsPage() {
  const [matrix, setMatrix] = useState<PermissionRule[]>(() => {
    try {
      const saved = localStorage.getItem("camsort_permissions_matrix");
      return saved ? JSON.parse(saved) : DEFAULT_MATRIX;
    } catch {
      return DEFAULT_MATRIX;
    }
  });

  const [saving, setSaving] = useState(false);

  const togglePermission = (
    ruleId: string,
    role: keyof PermissionRule["roles"],
  ) => {
    // SUPER_ADMIN always has full access
    if (role === "SUPER_ADMIN") {
      toast.info("Super Admin role always retains full platform permissions.");
      return;
    }

    setMatrix((prev) =>
      prev.map((rule) => {
        if (rule.id !== ruleId) return rule;
        return {
          ...rule,
          roles: {
            ...rule.roles,
            [role]: !rule.roles[role],
          },
        };
      }),
    );
  };

  const handleSave = () => {
    setSaving(true);
    try {
      localStorage.setItem(
        "camsort_permissions_matrix",
        JSON.stringify(matrix),
      );
      setTimeout(() => {
        setSaving(false);
        toast.success("Role permissions matrix saved successfully!");
      }, 300);
    } catch (e: any) {
      setSaving(false);
      toast.error(
        "Failed to save permissions: " + (e?.message || "Unknown error"),
      );
    }
  };

  const handleReset = () => {
    setMatrix(DEFAULT_MATRIX);
    localStorage.removeItem("camsort_permissions_matrix");
    toast.success("Reset to default permission rules.");
  };

  const categories = Array.from(new Set(matrix.map((m) => m.category)));

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-7 w-7 text-accent" /> Role & Permissions Matrix
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure system-wide capabilities, feature access, and data
            boundaries per user role.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Save className="h-3.5 w-3.5" />{" "}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="p-4 rounded-xl border border-border bg-card/60 flex items-start gap-3">
          <Info className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">
              Granular Role-Based Access Control (RBAC)
            </p>
            <p>
              Changes made here apply dynamically to all sessions across Super
              Admins, Studio Admins, Photographers, Staff, and public Guests.
              Super Admins always possess master privileges.
            </p>
          </div>
        </div>

        {categories.map((cat) => {
          const rules = matrix.filter((m) => m.category === cat);
          return (
            <Card
              key={cat}
              className="border border-border shadow-none overflow-hidden"
            >
              <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border">
                <CardTitle className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                  {cat}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/10 text-muted-foreground font-medium">
                        <th className="py-3 px-4 min-w-[220px]">
                          Permission & Description
                        </th>
                        <th className="py-3 px-3 text-center w-28">
                          Super Admin
                        </th>
                        <th className="py-3 px-3 text-center w-28">Admin</th>
                        <th className="py-3 px-3 text-center w-28">
                          Photographer
                        </th>
                        <th className="py-3 px-3 text-center w-28">Staff</th>
                        <th className="py-3 px-3 text-center w-28">Guest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rules.map((rule) => (
                        <tr
                          key={rule.id}
                          className="hover:bg-muted/10 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <p className="font-medium text-foreground text-sm">
                              {rule.name}
                            </p>
                            <p className="text-muted-foreground text-[11px] leading-relaxed mt-0.5">
                              {rule.description}
                            </p>
                          </td>

                          {/* Super Admin */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex justify-center">
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 gap-1"
                              >
                                <Lock className="h-2.5 w-2.5" /> Full
                              </Badge>
                            </div>
                          </td>

                          {/* Admin */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={rule.roles.ADMIN}
                                onCheckedChange={() =>
                                  togglePermission(rule.id, "ADMIN")
                                }
                              />
                            </div>
                          </td>

                          {/* Photographer */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={rule.roles.PHOTOGRAPHER}
                                onCheckedChange={() =>
                                  togglePermission(rule.id, "PHOTOGRAPHER")
                                }
                              />
                            </div>
                          </td>

                          {/* Staff */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={rule.roles.STAFF}
                                onCheckedChange={() =>
                                  togglePermission(rule.id, "STAFF")
                                }
                              />
                            </div>
                          </td>

                          {/* Guest */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={rule.roles.GUEST}
                                onCheckedChange={() =>
                                  togglePermission(rule.id, "GUEST")
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
