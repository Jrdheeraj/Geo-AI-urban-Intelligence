import { Globe } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card py-12 px-4">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Globe className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">GeoAI Urban Intelligence</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Built for sustainable urban planning. Powered by satellite imagery & machine learning.
        </p>
      </div>
    </footer>
  );
}
