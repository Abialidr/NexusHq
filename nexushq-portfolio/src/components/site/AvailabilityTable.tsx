"use client";

import { useState, useSyncExternalStore } from "react";
import styles from "./AvailabilityTable.module.css";

const IST = "Asia/Kolkata";
const SUGGESTED_ZONES = [
  "Asia/Kolkata",
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Dubai",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const SCHEDULES = [
  { hours: 20, weekdayHours: 4, weekdayIst: "6:00–10:00 PM", saturdayHours: 0 },
  { hours: 30, weekdayHours: 4, weekdayIst: "6:00–10:00 PM", saturdayHours: 10 },
  { hours: 40, weekdayHours: 6, weekdayIst: "6:00 PM–12:00 AM", saturdayHours: 10 },
] as const;

export default function AvailabilityTable() {
  const detectedZone = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || IST,
    () => null,
  );
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const timeZone = selectedZone || detectedZone;
  const timeZones = timeZone && !SUGGESTED_ZONES.includes(timeZone)
    ? [timeZone, ...SUGGESTED_ZONES]
    : SUGGESTED_ZONES;

  const getNextMonday = () => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: IST, year: "numeric", month: "numeric", day: "numeric",
    }).formatToParts(new Date());
    const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
    const year = part("year");
    const month = part("month");
    const day = part("day");
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const daysUntilMonday = (8 - weekday) % 7 || 7;
    return Date.UTC(year, month - 1, day + daysUntilMonday);
  };

  const clock = (instant: Date, zone: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone, hour: "numeric", minute: "2-digit",
    }).format(instant);

  const weekday = (instant: Date, zone: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone, weekday: "short",
    }).format(instant);

  const windowInZone = (mondayDateUtc: number, dayOffset: number, startHourIst: number, durationHours: number, zone: string) => {
    const start = new Date(mondayDateUtc + dayOffset * 86_400_000 + (startHourIst - 5) * 3_600_000 - 30 * 60_000);
    const end = new Date(start.getTime() + durationHours * 3_600_000);
    return {
      startDay: weekday(start, zone),
      endDay: weekday(end, zone),
      startTime: clock(start, zone),
      endTime: clock(end, zone),
    };
  };

  const formatWeekdays = (mondayDateUtc: number, durationHours: number, zone: string) => {
    const days = Array.from({ length: 5 }, (_, index) =>
      windowInZone(mondayDateUtc, index, 18, durationHours, zone));
    const uniform = days.every((day) =>
      day.startTime === days[0].startTime &&
      day.endTime === days[0].endTime &&
      (day.startDay === day.endDay) === (days[0].startDay === days[0].endDay));
    if (!uniform) {
      return days.map((day) =>
        `${day.startDay} ${day.startTime}–${day.endDay === day.startDay ? "" : `${day.endDay} `}${day.endTime}`).join("; ");
    }
    const first = days[0];
    const last = days[4];
    const overnight = first.startDay !== first.endDay ? " (ends next day)" : "";
    return `${first.startDay}–${last.startDay} ${first.startTime}–${first.endTime}${overnight}`;
  };

  const formatSaturday = (mondayDateUtc: number, zone: string) => {
    const day = windowInZone(mondayDateUtc, 5, 9, 10, zone);
    return `${day.startDay} ${day.startTime}–${day.endDay === day.startDay ? "" : `${day.endDay} `}${day.endTime}`;
  };

  const mondayDateUtc = timeZone ? getNextMonday() : null;
  const weekLabel = mondayDateUtc
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: IST, month: "short", day: "numeric", year: "numeric",
      }).format(new Date(mondayDateUtc))
    : "";

  return (
    <section className="section" aria-labelledby="availability-heading">
      <div className={styles.heading}>
        <div>
          <span className="kicker">Freelance availability</span>
          <h2 id="availability-heading" className="h-sec">Working hours, in your time zone</h2>
          <p className="muted">I am transitioning from full-time employment to full-time freelance work. These are my available weekly schedules.</p>
        </div>
        <div className={styles.zoneControl}>
          <label htmlFor="visitor-time-zone">Your time zone</label>
          <select
            id="visitor-time-zone"
            value={timeZone ?? ""}
            onChange={(event) => setSelectedZone(event.target.value)}
          >
            {!timeZone && <option value="" disabled>Detecting your time zone…</option>}
            {timeZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>Weekly freelance schedules. Local times shown for the week beginning {weekLabel || "next Monday"}.</caption>
          <thead>
            <tr>
              <th scope="col">Weekly capacity</th>
              <th scope="col">Monday–Friday in IST</th>
              <th scope="col">Monday–Friday in your time</th>
              <th scope="col">Saturday in your time</th>
            </tr>
          </thead>
          <tbody>
            {SCHEDULES.map((schedule) => (
              <tr key={schedule.hours}>
                <th scope="row">{schedule.hours} hours / week</th>
                <td>{schedule.weekdayIst}</td>
                <td>{timeZone && mondayDateUtc !== null
                  ? formatWeekdays(mondayDateUtc, schedule.weekdayHours, timeZone)
                  : "Detecting your time zone…"}</td>
                <td>{schedule.saturdayHours
                  ? timeZone && mondayDateUtc !== null
                    ? formatSaturday(mondayDateUtc, timeZone)
                    : "9:00 AM–7:00 PM IST"
                  : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>Saturday is 9:00 AM–7:00 PM IST for the 30- and 40-hour plans. Times are converted for the upcoming week, so daylight saving changes are reflected.</p>
    </section>
  );
}
