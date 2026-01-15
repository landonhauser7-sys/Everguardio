/**
 * Payout calculation utilities
 * Business day calculations and week management for commission payouts
 */

/**
 * Add business days to a date (skips weekends)
 * @param startDate - The starting date
 * @param daysToAdd - Number of business days to add
 * @returns The resulting date after adding business days
 */
export function addBusinessDays(startDate: Date, daysToAdd: number): Date {
  const result = new Date(startDate);
  let addedDays = 0;

  while (addedDays < daysToAdd) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }

  return result;
}

/**
 * Calculate deposit date from effective date
 * Deposit date = Effective Date + 3 business days
 * @param effectiveDate - The policy effective date
 * @returns The calculated deposit date
 */
export function calculateDepositDate(effectiveDate: Date): Date {
  return addBusinessDays(effectiveDate, 3);
}

/**
 * Get the Monday of the week containing the given date
 * @param date - Any date
 * @returns The Monday of that week
 */
export function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  if (dayOfWeek === 0) {
    // Sunday -> go back 6 days to get Monday
    result.setDate(result.getDate() - 6);
  } else {
    // Other days -> go back (dayOfWeek - 1) days
    result.setDate(result.getDate() - (dayOfWeek - 1));
  }

  // Reset time to start of day
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the Sunday of the week containing the given date
 * @param date - Any date
 * @returns The Sunday of that week
 */
export function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  const result = new Date(weekStart);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get week start and end dates for a given date
 * @param date - Any date
 * @returns Object with weekStart (Monday) and weekEnd (Sunday)
 */
export function getWeekBounds(date: Date): { weekStart: Date; weekEnd: Date } {
  return {
    weekStart: getWeekStart(date),
    weekEnd: getWeekEnd(date),
  };
}

/**
 * Format a date as YYYY-MM-DD for database storage
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatDateForDB(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Parse a date string and return a Date object in local timezone
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object
 */
export function parseDateLocal(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get an array of dates for each day in a week
 * @param weekStart - The Monday of the week
 * @returns Array of 7 dates (Mon-Sun)
 */
export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
}

/**
 * Get the day name for a date
 * @param date - The date
 * @returns Day name (Monday, Tuesday, etc.)
 */
export function getDayName(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

/**
 * Check if two dates are the same day
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Navigate to previous week
 * @param currentWeekStart - Current week's Monday
 * @returns Previous week's Monday
 */
export function getPreviousWeek(currentWeekStart: Date): Date {
  const result = new Date(currentWeekStart);
  result.setDate(result.getDate() - 7);
  return result;
}

/**
 * Navigate to next week
 * @param currentWeekStart - Current week's Monday
 * @returns Next week's Monday
 */
export function getNextWeek(currentWeekStart: Date): Date {
  const result = new Date(currentWeekStart);
  result.setDate(result.getDate() + 7);
  return result;
}

/**
 * Check if a week is the current week
 * @param weekStart - The Monday to check
 * @returns True if this is the current week
 */
export function isCurrentWeek(weekStart: Date): boolean {
  const today = new Date();
  const currentWeekStart = getWeekStart(today);
  return isSameDay(weekStart, currentWeekStart);
}

/**
 * Format week range for display
 * @param weekStart - Monday of the week
 * @param weekEnd - Sunday of the week
 * @returns Formatted string like "Jan 13 - Jan 19, 2025"
 */
export function formatWeekRange(weekStart: Date, weekEnd: Date): string {
  const startMonth = weekStart.toLocaleDateString("en-US", { month: "short" });
  const endMonth = weekEnd.toLocaleDateString("en-US", { month: "short" });
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const year = weekEnd.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}
