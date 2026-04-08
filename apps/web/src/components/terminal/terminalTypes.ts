export interface MarketIndex {
  id: string
  name: string
  country: string
  countryCode: string
  ytdReturn: number
  pltmEps: number | null
  divYield: number
  marketCap: number
  volume: number
  chartData: number[]
  price: number
  dailyChange: number
  dailyChangePercent: number
}
