import type { AxiosInstance } from 'axios'
import type { Settings } from '../settings'
import type { LanguagesMap } from './language'
import { formatError } from '../utils'

const pageUrl = 'https://www.bing.com/translator'
const translateApi = 'https://www.bing.com/ttranslatev3'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'

// ponytail: session cached 50 min — token TTL from Bing is 1h, refresh before it expires
let sessionCache: { key: string, token: string, ig: string, cookies: string, expiresAt: number } | null = null

async function getSession(axiosInstance: AxiosInstance) {
  if (sessionCache && Date.now() < sessionCache.expiresAt)
    return sessionCache

  const res = await axiosInstance.get(pageUrl, {
    headers: { 'User-Agent': UA },
  })

  const html: string = res.data
  const abuseMatch = html.match(/params_AbusePreventionHelper\s*=\s*\[([^\]]+)\]/)
  const igMatch = html.match(/IG:"([^"]+)"/)
  if (!abuseMatch || !igMatch)
    throw new Error('Failed to extract Bing session data from translator page')

  const parts = abuseMatch[1].split(',')
  const key = parts[0].trim()
  const token = parts[1].trim().replace(/"/g, '')
  const ig = igMatch[1]

  const setCookie = res.headers['set-cookie'] as string[] | undefined
  const cookies = setCookie ? setCookie.map((c: string) => c.split(';')[0]).join('; ') : ''

  sessionCache = { key, token, ig, cookies, expiresAt: Date.now() + 50 * 60 * 1000 }
  return sessionCache
}

export async function translate(
  text: string,
  from: string,
  to: string,
  axiosInstance: AxiosInstance,
  _options: Settings,
): Promise<string> {
  try {
    const { key, token, ig, cookies } = await getSession(axiosInstance)

    const body = new URLSearchParams({
      fromLang: from || 'auto-detect',
      to,
      text,
      token,
      key,
    })

    const res = await axiosInstance.post(
      `${translateApi}?isVertical=1&IG=${ig}&IID=translator.5024`,
      body.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': UA,
          'Origin': 'https://www.bing.com',
          'Referer': 'https://www.bing.com/translator',
          ...(cookies ? { 'Cookie': cookies } : {}),
        },
      },
    )

    const data = res.data
    if (data[0]?.translations?.[0])
      return data[0].translations[0].text.trim()
    return JSON.stringify(data)
  }
  catch (error) {
    // Invalidate session on error so next call gets a fresh one
    sessionCache = null
    return formatError(error)
  }
}

// https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support
export const languagesMap: LanguagesMap = {
  auto: '',
  zh: 'zh-Hans',
  zh_hant: 'zh-Hant',
  yue: 'yue',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  es: 'es',
  ru: 'ru',
  de: 'de',
  it: 'it',
  tr: 'tr',
  pt_br: 'pt',
  pt_pt: 'pt',
  vi: 'vi',
  id: 'id',
  th: 'th',
  ms: 'ms',
  ar: 'ar',
  hi: 'hi',
  ml: 'ml',
  mn_cy: 'mn-Cyrl',
  km: 'km',
  nb_no: 'nb',
  fa: 'fa',
  sv: 'sv',
  pl: 'pl',
  nl: 'nl',
  uk: 'uk',
  he: 'he',
  bg: 'bg',
  cs: 'cs',
  da: 'da',
  et: 'et',
  fi: 'fi',
  el: 'el',
  hu: 'hu',
  lv: 'lv',
  lt: 'lt',
  ro: 'ro',
  sk: 'sk',
  sl: 'sl',
}
