"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { 
  Menu, 
  FileText, 
  BookOpen, 
  Tags, 
  Search, 
  Settings,
  Plus,
  LogOut,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useZoteroAuth } from "@/hooks/use-zotero-auth";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const sidebarItems = [
  {
    icon: FileText,
    label: "All Papers",
    href: "/papers",
    active: true
  },
  {
    icon: BookOpen,
    label: "Collections",
    href: "/collections"
  },
  {
    icon: Tags,
    label: "Tags",
    href: "/tags"
  },
  {
    icon: Search,
    label: "Search",
    href: "/search"
  },
  {
    icon: Settings,
    label: "Settings",
    href: "/settings"
  }
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useZoteroAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <Sidebar />
            </SheetContent>
          </Sheet>
          
          <div className="flex items-center space-x-4 ml-4">
            <h1 className="text-xl font-semibold">PaperMind</h1>
          </div>

          <div className="ml-auto flex items-center space-x-3">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Paper
            </Button>
            
            {/* User info and logout */}
            {user && (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {user.display_name || user.zotero_username || 'Zotero User'}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={logout}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <div className="w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <Button
                key={item.href}
                variant={item.active ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2",
                  item.active && "bg-secondary"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}