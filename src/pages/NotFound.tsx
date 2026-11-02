import { Link } from "react-router-dom";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="space-y-6 max-w-sm">
        {/* Icon */}
        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto">
          <Camera className="h-9 w-9 text-muted-foreground opacity-50" />
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-accent tracking-widest uppercase">
            404
          </p>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* CTA */}
        <Button asChild>
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>

      <p className="absolute bottom-6 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} CamSort
      </p>
    </div>
  );
}
