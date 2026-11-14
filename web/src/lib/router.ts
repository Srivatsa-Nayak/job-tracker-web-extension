import { useSyncExternalStore } from 'react'

export type Route = 'jobs' | 'tracker' | 'profile' | 'settings'

const ROUTES: Route[] = ['jobs', 'tracker', 'profile', 'settings']

function current(): Route {
  const name = window.location.hash.replace(/^#\/?/, '')
  return (ROUTES as string[]).includes(name) ? (name as Route) : 'jobs'
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, current)
}

export function navigate(route: Route) {
  window.location.hash = `/${route}`
}
