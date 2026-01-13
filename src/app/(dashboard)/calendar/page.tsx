"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  parseISO,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Clock,
  MapPin,
  Users,
  Video,
  ExternalLink,
  AlertCircle,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  type: "training" | "meeting" | "announcement" | "deadline" | "other";
  hangoutLink?: string;
  attendees?: number;
  allDay?: boolean;
}

interface CalendarConfig {
  connected: boolean;
  calendarId?: string;
  lastSynced?: string;
}

const eventTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  training: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500" },
  meeting: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500" },
  announcement: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500" },
  deadline: { bg: "bg-red-500/10", text: "text-red-600", border: "border-red-500" },
  other: { bg: "bg-gray-500/10", text: "text-gray-600", border: "border-gray-500" },
};

const eventTypeLabels: Record<string, string> = {
  training: "Training",
  meeting: "Meeting",
  announcement: "Announcement",
  deadline: "Deadline",
  other: "Other",
};

export default function CalendarPage() {
  const { data: session } = useSession();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [config, setConfig] = useState<CalendarConfig>({ connected: false });
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN";

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const response = await fetch(
        `/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
        setConfig(data.config || { connected: false });
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch("/api/calendar/connect", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      }
    } catch (error) {
      console.error("Error connecting to Google:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSyncCalendar = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/calendar/sync", { method: "POST" });
      if (response.ok) {
        await fetchEvents();
      }
    } catch (error) {
      console.error("Error syncing calendar:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const eventStart = parseISO(event.start);
      return isSameDay(eventStart, day);
    });
  };

  // Get events for selected date
  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  // Get upcoming events (next 7 days)
  const today = new Date();
  const upcomingEvents = events
    .filter((event) => {
      const eventDate = parseISO(event.start);
      return eventDate >= today;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-8 w-8" />
            Agency Calendar
          </h1>
          <p className="text-muted-foreground">
            Trainings, meetings, and important announcements
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && config.connected && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncCalendar}
              disabled={isSyncing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
              Sync
            </Button>
          )}
          {isAdmin && (
            <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent>
                <AddEventForm
                  onSuccess={() => {
                    setIsAddEventOpen(false);
                    fetchEvents();
                  }}
                  onCancel={() => setIsAddEventOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Google Calendar Connection Status (Admin Only) */}
      {isAdmin && !config.connected && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium">Connect Google Calendar</p>
                  <p className="text-sm text-muted-foreground">
                    Sync events from your Google Calendar to keep the team updated
                  </p>
                </div>
              </div>
              <Button onClick={handleConnectGoogle} disabled={isConnecting}>
                {isConnecting ? "Connecting..." : "Connect Google Calendar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar Grid and Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday}>
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div
                      key={day}
                      className="text-center text-sm font-medium text-muted-foreground py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day) => {
                    const dayEvents = getEventsForDay(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isToday = isSameDay(day, today);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          "min-h-[80px] p-1 rounded-lg border text-left transition-colors",
                          "hover:bg-accent hover:border-accent-foreground/20",
                          !isCurrentMonth && "opacity-40",
                          isToday && "border-primary bg-primary/5",
                          isSelected && "border-primary ring-2 ring-primary/20"
                        )}
                      >
                        <div
                          className={cn(
                            "text-sm font-medium mb-1",
                            isToday && "text-primary"
                          )}
                        >
                          {format(day, "d")}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className={cn(
                                "text-xs px-1 py-0.5 rounded truncate",
                                eventTypeColors[event.type]?.bg,
                                eventTypeColors[event.type]?.text
                              )}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-muted-foreground px-1">
                              +{dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Selected Date Events */}
          {selectedDate && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {format(selectedDate, "EEEE, MMMM d")}
                </CardTitle>
                <CardDescription>
                  {selectedDateEvents.length} event
                  {selectedDateEvents.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedDateEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No events scheduled
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedDateEvents.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Upcoming Events</CardTitle>
              <CardDescription>Next scheduled events</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming events
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <EventCard key={event.id} event={event} showDate />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event Type Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Event Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(eventTypeColors).map(([type, colors]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full border-2",
                        colors.border,
                        colors.bg
                      )}
                    />
                    <span className="text-sm">{eventTypeLabels[type]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EventCard({
  event,
  showDate = false,
}: {
  event: CalendarEvent;
  showDate?: boolean;
}) {
  const colors = eventTypeColors[event.type] || eventTypeColors.other;
  const eventStart = parseISO(event.start);
  const eventEnd = parseISO(event.end);

  return (
    <div
      className={cn(
        "p-3 rounded-lg border-l-4",
        colors.bg,
        colors.border
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{event.title}</p>
          {showDate && (
            <p className="text-xs text-muted-foreground">
              {format(eventStart, "EEE, MMM d")}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {event.allDay
                ? "All day"
                : `${format(eventStart, "h:mm a")} - ${format(eventEnd, "h:mm a")}`}
            </span>
            {event.location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3" />
                {event.location}
              </span>
            )}
          </div>
        </div>
        <Badge variant="outline" className={cn("text-xs shrink-0", colors.text)}>
          {eventTypeLabels[event.type]}
        </Badge>
      </div>
      {event.description && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {event.description}
        </p>
      )}
      {event.hangoutLink && (
        <a
          href={event.hangoutLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
        >
          <Video className="h-3 w-3" />
          Join meeting
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function AddEventForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "meeting",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    allDay: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const start = formData.allDay
        ? `${formData.date}T00:00:00`
        : `${formData.date}T${formData.startTime}:00`;
      const end = formData.allDay
        ? `${formData.date}T23:59:59`
        : `${formData.date}T${formData.endTime}:00`;

      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          type: formData.type,
          start,
          end,
          location: formData.location || undefined,
          allDay: formData.allDay,
        }),
      });

      if (response.ok) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error creating event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Add Event</DialogTitle>
        <DialogDescription>
          Create a new event for the agency calendar
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="title">Event Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Team Training: New Product Launch"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Event Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allDay"
            checked={formData.allDay}
            onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="allDay" className="font-normal">
            All day event
          </Label>
        </div>

        {!formData.allDay && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Conference Room A / Zoom"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Add details about this event..."
            rows={3}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Event"}
        </Button>
      </DialogFooter>
    </form>
  );
}
