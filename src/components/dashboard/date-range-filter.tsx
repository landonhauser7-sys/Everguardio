"use client";

import { useState } from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type DateRangePreset =
  | "today"
  | "7days"
  | "30days"
  | "90days"
  | "thisMonth"
  | "lastMonth"
  | "ytd"
  | "custom";

interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangeFilterProps {
  value: DateRangePreset;
  customRange?: DateRange;
  onChange: (preset: DateRangePreset, range: DateRange) => void;
}

const presetLabels: Record<DateRangePreset, string> = {
  today: "Today",
  "7days": "Last 7 Days",
  "30days": "Last 30 Days",
  "90days": "Last 90 Days",
  thisMonth: "This Month",
  lastMonth: "Last Month",
  ytd: "Year to Date",
  custom: "Custom Range",
};

function getPresetRange(preset: DateRangePreset): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return { from: today, to: now };
    case "7days":
      return { from: subDays(today, 6), to: now };
    case "30days":
      return { from: subDays(today, 29), to: now };
    case "90days":
      return { from: subDays(today, 89), to: now };
    case "thisMonth":
      return { from: startOfMonth(now), to: now };
    case "lastMonth":
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    case "ytd":
      return { from: startOfYear(now), to: now };
    default:
      return { from: subDays(today, 29), to: now };
  }
}

export function DateRangeFilter({ value, customRange, onChange }: DateRangeFilterProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date | undefined>(customRange?.from);
  const [tempTo, setTempTo] = useState<Date | undefined>(customRange?.to);

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === "custom") {
      setIsCustomOpen(true);
      return;
    }
    const range = getPresetRange(preset);
    onChange(preset, range);
  };

  const handleCustomApply = () => {
    if (tempFrom && tempTo) {
      onChange("custom", { from: tempFrom, to: tempTo });
      setIsCustomOpen(false);
    }
  };

  const displayLabel = value === "custom" && customRange
    ? `${format(customRange.from, "MMM d")} - ${format(customRange.to, "MMM d")}`
    : presetLabels[value];

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span>{displayLabel}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => handlePresetSelect("today")}>
            Today
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetSelect("7days")}>
            Last 7 Days
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetSelect("30days")}>
            Last 30 Days
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetSelect("90days")}>
            Last 90 Days
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handlePresetSelect("thisMonth")}>
            This Month
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetSelect("lastMonth")}>
            Last Month
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetSelect("ytd")}>
            Year to Date
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handlePresetSelect("custom")}>
            Custom Range...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom Date Range Popover */}
      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <PopoverTrigger asChild>
          <span className="hidden" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="end">
          <div className="space-y-4">
            <div className="text-sm font-medium">Select Date Range</div>
            <div className="flex gap-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">From</label>
                <Calendar
                  mode="single"
                  selected={tempFrom}
                  onSelect={setTempFrom}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">To</label>
                <Calendar
                  mode="single"
                  selected={tempTo}
                  onSelect={setTempTo}
                  disabled={(date) => date > new Date() || (tempFrom ? date < tempFrom : false)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsCustomOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCustomApply} disabled={!tempFrom || !tempTo}>
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { getPresetRange };
