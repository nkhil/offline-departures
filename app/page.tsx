"use client"

import { useEffect, useState } from "react"

type AppData = {
  name: string
  age?: string
}

export default function Home() {
  const [data, setData] = useState<AppData | null>(null)
  const [status, setStatus] = useState('Loading...')

   useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
          updateViaCache: 'all',
        })
        console.log('SW registered:', registration.scope)

        const warmUrls = Array.from(
          new Set([
            '/',
            '/data.json',
            '/manifest.webmanifest',
            '/192.png',
            '/512.png',
            ...Array.from(document.querySelectorAll('script[src], link[rel="stylesheet"][href], link[as="font"][href]')).map(
              (el) => (el as HTMLScriptElement | HTMLLinkElement).src || (el as HTMLLinkElement).href
            ),
          ])
        )

        const postWarmMessage = (reg: ServiceWorkerRegistration) => {
          reg.active?.postMessage({ type: 'WARM_CACHE', urls: warmUrls })
        }

        if (registration.active) {
          postWarmMessage(registration)
        } else {
          navigator.serviceWorker.ready.then(postWarmMessage).catch(() => {
            // Ignore warm-cache setup failures
          })
        }
      } catch (err) {
        console.error('SW registration failed:', err)
      }
    }

    register()
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/data.json') // served from SW cache when offline
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setData(json)
        setStatus('Loaded data.json successfully')
      } catch (err) {
        console.error(err)
        setStatus('Failed to load data.json')
      }
    }

    load()
  }, [])


  return (
     <main style={{ padding: 24 }}>
      <h1>Offline data test</h1>
      <p>{status}</p>
      {data && <h1>name: {data?.name}</h1>}
      {data && <h1>age: {data?.age}</h1>}
    </main>
  );
}
