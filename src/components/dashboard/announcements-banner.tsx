"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { X, AlertTriangle, Bell, Info, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: Priority;
  expires_at: string | null;
  created_at: string;
  users: {
    first_name: string;
    last_name: string;
  };
}

const priorityConfig: Record<Priority, { icon: React.ElementType; bgClass: string; borderClass: string; textClass: string }> = {
  LOW: {
    icon: Info,
    bgClass: "bg-muted",
    borderClass: "border-muted-foreground/20",
    textClass: "text-muted-foreground",
  },
  NORMAL: {
    icon: Bell,
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    borderClass: "border-blue-200 dark:border-blue-800",
    textClass: "text-blue-700 dark:text-blue-400",
  },
  HIGH: {
    icon: AlertCircle,
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    borderClass: "border-amber-200 dark:border-amber-800",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  URGENT: {
    icon: AlertTriangle,
    bgClass: "bg-red-50 dark:bg-red-950/30",
    borderClass: "border-red-200 dark:border-red-800",
    textClass: "text-red-700 dark:text-red-400",
  },
};

export function AnnouncementsBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();

    // Load dismissed IDs from localStorage
    const stored = localStorage.getItem("dismissedAnnouncements");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setDismissedIds(new Set(parsed));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  async function fetchAnnouncements() {
    try {
      const response = await fetch("/api/announcements?activeOnly=true");
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data);
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleDismiss(id: string) {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    localStorage.setItem("dismissedAnnouncements", JSON.stringify([...newDismissed]));
  }

  function toggleExpanded(id: string) {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  }

  const visibleAnnouncements = announcements.filter((a) => !dismissedIds.has(a.id));

  if (isLoading || visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {visibleAnnouncements.map((announcement) => {
        const config = priorityConfig[announcement.priority];
        const Icon = config.icon;
        const isExpanded = expandedIds.has(announcement.id);
        const isLongMessage = announcement.message.length > 150;

        return (
          <div
            key={announcement.id}
            className={cn(
              "rounded-lg border p-4 relative",
              config.bgClass,
              config.borderClass
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-6 w-6"
              onClick={() => handleDismiss(announcement.id)}
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="flex gap-3 pr-8">
              <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", config.textClass)} />
              <div className="flex-1 min-w-0">
                <h4 className={cn("font-semibold text-sm", config.textClass)}>
                  {announcement.title}
                </h4>
                <p
                  className={cn(
                    "text-sm mt-1",
                    config.textClass,
                    "opacity-90",
                    !isExpanded && isLongMessage && "line-clamp-2"
                  )}
                >
                  {announcement.message}
                </p>
                {isLongMessage && (
                  <Button
                    variant="link"
                    size="sm"
                    className={cn("h-auto p-0 mt-1", config.textClass)}
                    onClick={() => toggleExpanded(announcement.id)}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Read more
                      </>
                    )}
                  </Button>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                  <span>
                    {announcement.users.first_name} {announcement.users.last_name}
                  </span>
                  <span>•</span>
                  <span>{format(new Date(announcement.created_at), "MMM d")}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
