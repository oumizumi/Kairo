import GuessBackdrop from '@/components/guess/GuessBackdrop'
import { WeatherProvider } from '@/contexts/WeatherContext'

export default function GuessLayout({ children }: { children: React.ReactNode }) {
  return (
    <WeatherProvider>
      <GuessBackdrop />
      {children}
    </WeatherProvider>
  )
}
