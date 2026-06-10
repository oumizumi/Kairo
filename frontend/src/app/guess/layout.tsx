import GuessBackdrop from '@/components/guess/GuessBackdrop'

export default function GuessLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GuessBackdrop />
      {children}
    </>
  )
}
