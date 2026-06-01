import { getServiceRoleClient } from '@/lib/auth/admin'

const CHECKIN_BUCKET = 'coach-checkins'
const SIGNED_URL_TTL_SECONDS = 60 * 60

function getObjectPathFromStorageUrl(value: string) {
  try {
    const url = new URL(value)
    const decodedPath = decodeURIComponent(url.pathname)
    const markers = [
      `/storage/v1/object/public/${CHECKIN_BUCKET}/`,
      `/storage/v1/object/sign/${CHECKIN_BUCKET}/`,
      `/storage/v1/object/authenticated/${CHECKIN_BUCKET}/`,
    ]

    for (const marker of markers) {
      const index = decodedPath.indexOf(marker)
      if (index >= 0) {
        return decodedPath.slice(index + marker.length).replace(/^\/+/, '')
      }
    }
  } catch {
    return null
  }

  return null
}

export function getCoachCheckinPhotoObjectPath(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) {
    return getObjectPathFromStorageUrl(trimmed)
  }

  return trimmed.replace(/^\/+/, '')
}

export async function createCoachCheckinSignedUrlMap(values: Array<string | null | undefined>) {
  const sourceToPath = new Map<string, string>()
  const paths: string[] = []
  const seenPaths = new Set<string>()

  values.forEach((value) => {
    const source = value?.trim()
    if (!source) return

    const path = getCoachCheckinPhotoObjectPath(source)
    if (!path) return

    sourceToPath.set(source, path)
    if (!seenPaths.has(path)) {
      paths.push(path)
      seenPaths.add(path)
    }
  })

  const sourceToSignedUrl = new Map<string, string>()
  if (paths.length === 0) return sourceToSignedUrl

  const supabase = getServiceRoleClient()
  const { data, error } = await supabase.storage
    .from(CHECKIN_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)

  if (error || !data) {
    console.error('Unable to create coach check-in signed URLs:', error?.message)
    return sourceToSignedUrl
  }

  const pathToSignedUrl = new Map<string, string>()
  data.forEach((entry, index) => {
    if (entry.signedUrl) {
      pathToSignedUrl.set(paths[index], entry.signedUrl)
    }
  })

  sourceToPath.forEach((path, source) => {
    const signedUrl = pathToSignedUrl.get(path)
    if (signedUrl) sourceToSignedUrl.set(source, signedUrl)
  })

  return sourceToSignedUrl
}

export function getResolvedCoachCheckinPhotoUrl(
  sourceUrl: string | null | undefined,
  signedUrlMap: Map<string, string>,
) {
  const source = sourceUrl?.trim()
  if (!source) return null

  return signedUrlMap.get(source) || source
}
