"use client"

import { useEffect, useMemo, useState } from "react"

type DayType = "weekday" | "saturday" | "sunday"
type Direction = "to_london" | "from_london"

type Train = {
  depart: string
  dest_name?: string
  dest_time?: string
  operator: string
}

type Timetable = Record<DayType, Record<Direction, Train[]>>

type TrainWithCountdown = Train & { minutesAway: number }

function getDayType(date: Date): DayType {
  const day = date.getDay()
  if (day === 0) return "sunday"
  if (day === 6) return "saturday"
  return "weekday"
}

function timeToMinutes(hhmm: string): number {
  return Number.parseInt(hhmm.slice(0, 2), 10) * 60 + Number.parseInt(hhmm.slice(2), 10)
}

function minutesUntil(departHHMM: string, nowMinutes: number): number {
  let diff = timeToMinutes(departHHMM) - nowMinutes
  if (diff < -120) diff += 1440
  return diff
}

function formatTime(hhmm: string): string {
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`
}

function formatCountdown(minutes: number): string {
  if (minutes === 0) return "NOW"
  return `${minutes} min`
}

function getNext5(
  timetable: Timetable,
  dayType: DayType,
  direction: Direction,
  nowMinutes: number
): TrainWithCountdown[] {
  return timetable[dayType][direction]
    .map((train) => ({ ...train, minutesAway: minutesUntil(train.depart, nowMinutes) }))
    .filter((train) => train.minutesAway >= 0)
    .sort((a, b) => a.minutesAway - b.minutesAway)
    .slice(0, 5)
}

function isTrain(value: unknown): value is Train {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<Train>
  return typeof candidate.depart === "string" && typeof candidate.operator === "string"
}

function isTimetable(value: unknown): value is Timetable {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  const dayTypes: DayType[] = ["weekday", "saturday", "sunday"]
  const directions: Direction[] = ["to_london", "from_london"]

  return dayTypes.every((dayType) => {
    const dayBucket = record[dayType]
    if (!dayBucket || typeof dayBucket !== "object") return false

    const dayRecord = dayBucket as Record<string, unknown>
    return directions.every((direction) => {
      const trains = dayRecord[direction]
      return Array.isArray(trains) && trains.every(isTrain)
    })
  })
}

function extractTimetable(value: unknown): Timetable | null {
  if (isTimetable(value)) return value

  if (value && typeof value === "object") {
    const maybeNested = (value as { timetable?: unknown }).timetable
    if (isTimetable(maybeNested)) return maybeNested
  }

  return null
}

async function readTimetableFromCaches(): Promise<Timetable | null> {
  if (typeof window === "undefined" || !("caches" in window)) return null

  const cacheNames = await caches.keys()
  for (const cacheName of cacheNames.reverse()) {
    const cache = await caches.open(cacheName)
    const response = await cache.match("/data.json")
    if (!response) continue

    try {
      const cachedJson = (await response.clone().json()) as unknown
      const timetable = extractTimetable(cachedJson)
      if (timetable) return timetable
    } catch {
      // Ignore invalid cached payloads and keep searching
    }
  }

  return null
}

function BoardPanel({ trains }: { trains: TrainWithCountdown[] }) {
  if (trains.length === 0) {
    return <div className="no-trains">No more trains today</div>
  }

  return trains.map((train, idx) => {
    const urgent = train.minutesAway <= 2

    return (
      <div key={`${train.depart}-${train.dest_name ?? "unknown"}-${idx}`} className={`train-row${idx === 0 ? " soonest" : ""}`}>
        <span className="depart">{formatTime(train.depart)}</span>
        <span className="dest-block">
          <span className="dest-name">{train.dest_name ?? "Unknown"}</span>
          {train.dest_time ? <span className="dest-arr">arr {formatTime(train.dest_time)}</span> : null}
        </span>
        <span className={`badge badge-${train.operator}`}>{train.operator}</span>
        <span className={`countdown${urgent ? " urgent" : ""}`}>{formatCountdown(train.minutesAway)}</span>
      </div>
    )
  })
}

export default function Home() {
  const [timetable, setTimetable] = useState<Timetable | null>(null)
  const [status, setStatus] = useState("Loading timetable...")
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/service-worker.js", {
          scope: "/",
          updateViaCache: "all",
        })

        const warmAssetUrls = Array.from(
          document.querySelectorAll('script[src], link[rel="stylesheet"][href], link[as="font"][href]')
        )
          .map((element) => {
            if (element instanceof HTMLScriptElement) return element.src
            if (element instanceof HTMLLinkElement) return element.href
            return null
          })
          .filter((url): url is string => Boolean(url))

        const warmUrls = Array.from(
          new Set(["/", "/data.json", "/manifest.webmanifest", "/192.png", "/512.png", ...warmAssetUrls])
        )

        const postWarmMessage = (reg: ServiceWorkerRegistration) => {
          reg.active?.postMessage({ type: "WARM_CACHE", urls: warmUrls })
        }

        if (registration.active) {
          postWarmMessage(registration)
        } else {
          navigator.serviceWorker.ready.then(postWarmMessage).catch(() => {})
        }
      } catch (error) {
        console.error("SW registration failed:", error)
      }
    }

    register()
  }, [])

  useEffect(() => {
    const load = async () => {
      const cachedTimetable = await readTimetableFromCaches()
      if (cachedTimetable) {
        setTimetable(cachedTimetable)
        setStatus("Loaded from offline cache")
        return
      }

      setStatus("No cached timetable yet")
    }

    load()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const dayType = getDayType(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const toLondon = useMemo(
    () => (timetable ? getNext5(timetable, dayType, "to_london", nowMinutes) : []),
    [dayType, nowMinutes, timetable]
  )

  const fromLondon = useMemo(
    () => (timetable ? getNext5(timetable, dayType, "from_london", nowMinutes) : []),
    [dayType, nowMinutes, timetable]
  )

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const dayLabel = `${dayNames[now.getDay()]} — ${dayType.charAt(0).toUpperCase() + dayType.slice(1)} timetable`
  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`

  return (
    <main className="page">
      <header>
        <div id="clock">{clock}</div>
        <div id="day-label">{dayLabel}</div>
        <div id="station-label">Harringay (HGY)</div>
      </header>

      <section id="board">
        <article>
          <div className="panel-title">To London</div>
          {timetable ? <BoardPanel trains={toLondon} /> : <div className="no-trains">{status}</div>}
        </article>
        <article>
          <div className="panel-title">From London</div>
          {timetable ? <BoardPanel trains={fromLondon} /> : <div className="no-trains">{status}</div>}
        </article>
      </section>

      <footer>
        Works offline — data is loaded from <code>data.json</code> and cached by the service worker.
      </footer>
    </main>
  )
}
