"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus,
  Megaphone,
  Loader2,
  Pencil,
  Trash2,
  AlertTriangle,
  Bell,
  Info,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: Priority;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  users: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

const priorityConfig: Record<Priority, { label: string; icon: React.ElementType; color: string }> = {
  LOW: { label: "Low", icon: Info, color: "text-muted-foreground" },
  NORMAL: { label: "Normal", icon: Bell, color: "text-blue-500" },
  HIGH: { label: "High", icon: AlertCircle, color: "text-amber-500" },
  URGENT: { label: "Urgent", icon: AlertTriangle, color: "text-red-500" },
};

const defaultFormData = {
  title: "",
  message: "",
  priority: "NORMAL" as Priority,
  expires_at: "",
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [deleteAnnouncement, setDeleteAnnouncement] = useState<Announcement | null>(null);

  const [formData, setFormData] = useState(defaultFormData);

  useEffect(() => {
    fetchAnnouncements();
  }, [showInactive]);

  async function fetchAnnouncements() {
    try {
      const params = new URLSearchParams({
        activeOnly: showInactive ? "false" : "true",
        includeExpired: "true",
      });
      const response = await fetch(`/api/announcements?${params}`);
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

  function openCreateDialog() {
    setEditingAnnouncement(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  }

  function openEditDialog(announcement: Announcement) {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      message: announcement.message,
      priority: announcement.priority,
      expires_at: announcement.expires_at
        ? format(new Date(announcement.expires_at), "yyyy-MM-dd'T'HH:mm")
        : "",
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingAnnouncement
        ? `/api/announcements/${editingAnnouncement.id}`
        : "/api/announcements";
      const method = editingAnnouncement ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          message: formData.message,
          priority: formData.priority,
          expires_at: formData.expires_at || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save announcement");
      }

      toast.success(editingAnnouncement ? "Announcement updated" : "Announcement created");
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      setEditingAnnouncement(null);
      fetchAnnouncements();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save announcement");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteAnnouncement) return;

    try {
      const response = await fetch(`/api/announcements/${deleteAnnouncement.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete announcement");
      }

      toast.success("Announcement deleted");
      setDeleteAnnouncement(null);
      fetchAnnouncements();
    } catch (error) {
      toast.error("Failed to delete announcement");
    }
  }

  async function toggleActive(announcement: Announcement) {
    try {
      const response = await fetch(`/api/announcements/${announcement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !announcement.is_active }),
      });

      if (!response.ok) {
        throw new Error("Failed to update announcement");
      }

      toast.success(`Announcement ${announcement.is_active ? "deactivated" : "activated"}`);
      fetchAnnouncements();
    } catch (error) {
      toast.error("Failed to update announcement");
    }
  }

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-8 w-8" />
            Announcements
          </h1>
          <p className="text-muted-foreground">
            Create and manage announcements for your team.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingAnnouncement ? "Edit Announcement" : "Create Announcement"}
              </DialogTitle>
              <DialogDescription>
                {editingAnnouncement
                  ? "Update the announcement details."
                  : "Create a new announcement for your team."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Announcement title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Write your announcement message..."
                  rows={4}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: Priority) =>
                      setFormData({ ...formData, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(priorityConfig) as Priority[]).map((p) => {
                        const config = priorityConfig[p];
                        return (
                          <SelectItem key={p} value={p}>
                            <div className="flex items-center gap-2">
                              <config.icon className={`h-4 w-4 ${config.color}`} />
                              {config.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expires_at">Expires (optional)</Label>
                  <Input
                    id="expires_at"
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingAnnouncement ? "Saving..." : "Creating..."}
                    </>
                  ) : editingAnnouncement ? (
                    "Save Changes"
                  ) : (
                    "Create Announcement"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {announcements.length} announcement{announcements.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm text-muted-foreground">
                Show inactive
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No announcements yet</p>
              <p className="text-sm">Create your first announcement to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => {
                const config = priorityConfig[announcement.priority];
                const expired = isExpired(announcement.expires_at);

                return (
                  <div
                    key={announcement.id}
                    className={`border rounded-lg p-4 ${
                      !announcement.is_active || expired ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <config.icon className={`h-4 w-4 ${config.color}`} />
                          <h3 className="font-semibold truncate">{announcement.title}</h3>
                          <Badge
                            variant="outline"
                            className={
                              announcement.priority === "URGENT"
                                ? "border-red-500 text-red-600"
                                : announcement.priority === "HIGH"
                                  ? "border-amber-500 text-amber-600"
                                  : ""
                            }
                          >
                            {config.label}
                          </Badge>
                          {!announcement.is_active && (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                          {expired && <Badge variant="destructive">Expired</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                          {announcement.message}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            By {announcement.users.first_name} {announcement.users.last_name}
                          </span>
                          <span>{format(new Date(announcement.created_at), "MMM d, yyyy")}</span>
                          {announcement.expires_at && (
                            <span>
                              Expires: {format(new Date(announcement.expires_at), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={announcement.is_active}
                          onCheckedChange={() => toggleActive(announcement)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(announcement)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteAnnouncement(announcement)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteAnnouncement} onOpenChange={() => setDeleteAnnouncement(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteAnnouncement?.title}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
