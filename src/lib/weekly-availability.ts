/**
 * Weekly availability — ported verbatim from the native app's `utils/weeklyAvailability.ts`.
 *
 * The backend stores these slots in UTC while both surfaces edit them in the
 * viewer's own zone, so the conversion has to agree exactly between the two
 * repositories or a slot saved on the web would move when the native app reads
 * it back. Keep this file in step with the native copy; it has no dependencies
 * precisely so it can be shared by copy.
 */
export const WEEKLY_DAYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export type WeeklyDayOfWeek = (typeof WEEKLY_DAYS)[number];

export type WeeklyAvailabilitySlot = {
  dayOfWeek: WeeklyDayOfWeek;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
};

export type WeeklyScheduleMap = Record<WeeklyDayOfWeek, string[]>;

const DAY_SHORT_LABELS: Record<WeeklyDayOfWeek, string> = {
  SUNDAY: "Sun",
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
};

export const isValidWeeklyTime = (value: string): boolean => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
};

/**
 * End times may also be 24:00 — the exact midnight a slot split at a day
 * boundary ends on. The backend's own END_TIME_PATTERN allows it for the same
 * reason; start times still may not be 24:00.
 */
export const isValidWeeklyEndTime = (value: string): boolean => {
  return value === "24:00" || isValidWeeklyTime(value);
};

const toMinutes = (value: string): number => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

const isWeeklyDay = (value: unknown): value is WeeklyDayOfWeek => {
  return typeof value === "string" && WEEKLY_DAYS.includes(value as WeeklyDayOfWeek);
};

export const normalizeWeeklyAvailability = (
  input: unknown,
): WeeklyAvailabilitySlot[] => {
  let raw = input;

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(raw)) return [];

  const normalized = raw
    .map((item) => {
      // `as any` in the native copy; this repository's lint rejects it.
      const slot = (item ?? {}) as Record<string, unknown>;
      const dayOfWeek = slot.dayOfWeek;
      const startTime = slot.startTime;
      const endTime = slot.endTime;

      if (
        !isWeeklyDay(dayOfWeek) ||
        typeof startTime !== "string" ||
        typeof endTime !== "string" ||
        !isValidWeeklyTime(startTime) ||
        !isValidWeeklyEndTime(endTime) ||
        toMinutes(startTime) >= toMinutes(endTime)
      ) {
        return null;
      }

      return {
        dayOfWeek,
        startTime,
        endTime,
      } satisfies WeeklyAvailabilitySlot;
    })
    .filter(Boolean) as WeeklyAvailabilitySlot[];

  return sortWeeklyAvailability(normalized);
};

export const sortWeeklyAvailability = (
  slots: WeeklyAvailabilitySlot[],
): WeeklyAvailabilitySlot[] => {
  return [...slots].sort((a, b) => {
    const dayDiff = WEEKLY_DAYS.indexOf(a.dayOfWeek) - WEEKLY_DAYS.indexOf(b.dayOfWeek);
    if (dayDiff !== 0) return dayDiff;
    return toMinutes(a.startTime) - toMinutes(b.startTime);
  });
};

export const formatWeeklyTimeTo12Hour = (value: string): string => {
  if (!isValidWeeklyTime(value)) return value;
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${minutes.toString().padStart(2, "0")} ${suffix}`;
};

export const formatWeeklyAvailabilityLabel = (
  slot: WeeklyAvailabilitySlot,
): string => {
  return `${DAY_SHORT_LABELS[slot.dayOfWeek]} ${formatWeeklyTimeTo12Hour(slot.startTime)}-${formatWeeklyTimeTo12Hour(slot.endTime)}`;
};

export const summarizeWeeklyAvailability = (
  slots: WeeklyAvailabilitySlot[],
): string => {
  if (!slots.length) return "Available anytime";
  return `${slots.length} weekly slot${slots.length > 1 ? "s" : ""}`;
};

export const toWeeklyScheduleMap = (
  weeklyAvailability: WeeklyAvailabilitySlot[] = [],
): WeeklyScheduleMap => {
  // `as unknown as` rather than the native copy's single cast: this repository
  // compiles with stricter settings and rejects the direct conversion.
  const schedule = Object.fromEntries(
    WEEKLY_DAYS.map((day) => [day, []]),
  ) as unknown as WeeklyScheduleMap;

  weeklyAvailability.forEach((slot) => {
    schedule[slot.dayOfWeek].push(`${slot.startTime}-${slot.endTime}`);
  });

  return schedule;
};

export const getViewerTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export const scheduleMapToWeeklyAvailability = (
  schedule: unknown,
): WeeklyAvailabilitySlot[] => {
  if (!schedule || typeof schedule !== "object") return [];

  const slots: WeeklyAvailabilitySlot[] = [];
  WEEKLY_DAYS.forEach((day) => {
    const dayRanges = (schedule as Record<string, unknown>)[day];
    if (!Array.isArray(dayRanges)) return;

    dayRanges.forEach((range) => {
      if (typeof range !== "string") return;
      const [startTime, endTime] = range.split("-");
      if (!startTime || !endTime) return;
      if (!isValidWeeklyTime(startTime) || !isValidWeeklyTime(endTime)) return;
      if (toMinutes(startTime) >= toMinutes(endTime)) return;
      slots.push({
        dayOfWeek: day,
        startTime,
        endTime,
      });
    });
  });

  return sortWeeklyAvailability(slots);
};

type LocalDateTimeInput = {
  year: number;
  month: number; // 1-based
  day: number;
  hour: number;
  minute: number;
  timeZone: string;
};

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getDateTimeFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = dateTimeFormatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  dateTimeFormatterCache.set(timeZone, formatter);
  return formatter;
};

const getWeekdayFormatter = (timeZone: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  });

const getZonedParts = (
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number } => {
  const parts = getDateTimeFormatter(timeZone).formatToParts(date);
  const partMap: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== "literal") partMap[part.type] = part.value;
  });
  return {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
    hour: Number(partMap.hour),
    minute: Number(partMap.minute),
  };
};

const getReferenceSunday = (
  timeZone: string,
): { year: number; month: number; day: number } => {
  const now = new Date();
  const zonedNow = getZonedParts(now, timeZone);
  const weekdayRaw = getWeekdayFormatter(timeZone).format(now).toUpperCase();
  const dayIndex = WEEKLY_DAYS.indexOf(weekdayRaw as WeeklyDayOfWeek);
  const safeDayIndex = dayIndex >= 0 ? dayIndex : 0;

  // Treat zoned calendar date as a plain date and step back to Sunday.
  const localDateUtc = new Date(
    Date.UTC(zonedNow.year, zonedNow.month - 1, zonedNow.day, 0, 0, 0, 0),
  );
  localDateUtc.setUTCDate(localDateUtc.getUTCDate() - safeDayIndex);

  return {
    year: localDateUtc.getUTCFullYear(),
    month: localDateUtc.getUTCMonth() + 1,
    day: localDateUtc.getUTCDate(),
  };
};

const zonedLocalToUtcDate = ({
  year,
  month,
  day,
  hour,
  minute,
  timeZone,
}: LocalDateTimeInput): Date => {
  // Start from a UTC guess and iteratively correct by the zoned clock drift.
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  for (let i = 0; i < 3; i += 1) {
    const actual = getZonedParts(guess, timeZone);
    const desiredTotal = Date.UTC(year, month - 1, day, hour, minute) / 60000;
    const actualTotal =
      Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
      ) / 60000;
    const diffMinutes = desiredTotal - actualTotal;
    if (diffMinutes === 0) break;
    guess = new Date(guess.getTime() + diffMinutes * 60 * 1000);
  }
  return guess;
};

const formatUtcHHmm = (date: Date): string =>
  `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;

const formatPartsHHmm = (hour: number, minute: number): string =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

const zonedDayOfWeek = (
  year: number,
  month: number,
  day: number,
): WeeklyDayOfWeek => WEEKLY_DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

/**
 * One slot, expressed on whichever day each end of it falls on.
 *
 * A slot is stored as a day plus a start and end within that day, but the same
 * hours can land on two different days once converted to another zone: 5pm-11pm
 * in Toronto is 21:00 Monday to 03:00 Tuesday in UTC. Both halves are kept —
 * the first ending at 24:00, the second starting at 00:00 — because dropping
 * the slot instead is indistinguishable, to the person who entered it, from the
 * save silently failing. `mergeContiguousWeeklyAvailability` rejoins them when
 * a later conversion puts them back on one day.
 */
const splitAcrossDayBoundary = (
  startDay: WeeklyDayOfWeek,
  startTime: string,
  endDay: WeeklyDayOfWeek,
  endTime: string,
): WeeklyAvailabilitySlot[] => {
  if (startDay === endDay) {
    return toMinutes(startTime) < toMinutes(endTime)
      ? [{ dayOfWeek: startDay, startTime, endTime }]
      : [];
  }

  // Anything longer than one crossing is a slot over 24 hours, which the
  // editors cannot produce and which is not meaningful weekly availability.
  const dayGap =
    (WEEKLY_DAYS.indexOf(endDay) - WEEKLY_DAYS.indexOf(startDay) + 7) % 7;
  if (dayGap !== 1) return [];

  const pieces: WeeklyAvailabilitySlot[] = [];
  if (toMinutes(startTime) < 24 * 60) {
    pieces.push({ dayOfWeek: startDay, startTime, endTime: "24:00" });
  }
  if (toMinutes(endTime) > 0) {
    pieces.push({ dayOfWeek: endDay, startTime: "00:00", endTime });
  }
  return pieces;
};

/**
 * Sorts slots and joins any that touch on the same day, so a slot that was
 * split at a day boundary in one zone comes back as the single slot it was.
 * Overlapping slots a person entered separately are joined by the same rule.
 */
export const mergeContiguousWeeklyAvailability = (
  slots: WeeklyAvailabilitySlot[],
): WeeklyAvailabilitySlot[] => {
  const merged: WeeklyAvailabilitySlot[] = [];

  for (const slot of sortWeeklyAvailability(slots)) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.dayOfWeek === slot.dayOfWeek &&
      toMinutes(slot.startTime) <= toMinutes(previous.endTime)
    ) {
      if (toMinutes(slot.endTime) > toMinutes(previous.endTime)) {
        previous.endTime = slot.endTime;
      }
      continue;
    }
    merged.push({ ...slot });
  }

  return merged;
};

export const convertWeeklyAvailabilityLocalToUTC = (
  localSlots: WeeklyAvailabilitySlot[],
  timeZone: string,
): WeeklyAvailabilitySlot[] => {
  if (!Array.isArray(localSlots) || !localSlots.length) return [];

  // Use the viewer's current local week to keep DST offset aligned with "now".
  const referenceSunday = getReferenceSunday(timeZone);

  const converted = localSlots
    .map((slot) => {
      const dayIndex = WEEKLY_DAYS.indexOf(slot.dayOfWeek);
      if (dayIndex < 0) return [];
      if (
        !isValidWeeklyTime(slot.startTime) ||
        !isValidWeeklyEndTime(slot.endTime)
      ) {
        return [];
      }

      const [startHour, startMinute] = slot.startTime.split(":").map(Number);
      const [endHour, endMinute] = slot.endTime.split(":").map(Number);
      const localDay = referenceSunday.day + dayIndex;

      const startUtc = zonedLocalToUtcDate({
        year: referenceSunday.year,
        month: referenceSunday.month,
        day: localDay,
        hour: startHour,
        minute: startMinute,
        timeZone,
      });
      const endUtc = zonedLocalToUtcDate({
        year: referenceSunday.year,
        month: referenceSunday.month,
        day: localDay,
        hour: endHour,
        minute: endMinute,
        timeZone,
      });

      const startDay = WEEKLY_DAYS[startUtc.getUTCDay()];
      const endDay = WEEKLY_DAYS[endUtc.getUTCDay()];

      return splitAcrossDayBoundary(
        startDay,
        formatUtcHHmm(startUtc),
        endDay,
        formatUtcHHmm(endUtc),
      );
    })
    .flat();

  return mergeContiguousWeeklyAvailability(converted);
};

export const convertWeeklyAvailabilityUTCToLocal = (
  utcSlots: WeeklyAvailabilitySlot[],
  timeZone: string,
): WeeklyAvailabilitySlot[] => {
  if (!Array.isArray(utcSlots) || !utcSlots.length) return [];

  // Use the viewer's current local week to keep DST offset aligned with "now".
  const referenceSunday = getReferenceSunday(timeZone);

  const converted = utcSlots
    .map((slot) => {
      const dayIndex = WEEKLY_DAYS.indexOf(slot.dayOfWeek);
      if (dayIndex < 0) return [];
      if (
        !isValidWeeklyTime(slot.startTime) ||
        !isValidWeeklyEndTime(slot.endTime)
      ) {
        return [];
      }

      const [startHour, startMinute] = slot.startTime.split(":").map(Number);
      const [endHour, endMinute] = slot.endTime.split(":").map(Number);
      const utcDay = referenceSunday.day + dayIndex;

      const startUtc = new Date(
        Date.UTC(
          referenceSunday.year,
          referenceSunday.month - 1,
          utcDay,
          startHour,
          startMinute,
          0,
          0,
        ),
      );
      const endUtc = new Date(
        Date.UTC(
          referenceSunday.year,
          referenceSunday.month - 1,
          utcDay,
          endHour,
          endMinute,
          0,
          0,
        ),
      );

      const startLocal = getZonedParts(startUtc, timeZone);
      const endLocal = getZonedParts(endUtc, timeZone);

      const startDay = zonedDayOfWeek(
        startLocal.year,
        startLocal.month,
        startLocal.day,
      );
      const endDay = zonedDayOfWeek(endLocal.year, endLocal.month, endLocal.day);

      return splitAcrossDayBoundary(
        startDay,
        formatPartsHHmm(startLocal.hour, startLocal.minute),
        endDay,
        formatPartsHHmm(endLocal.hour, endLocal.minute),
      );
    })
    .flat();

  return mergeContiguousWeeklyAvailability(converted);
};
