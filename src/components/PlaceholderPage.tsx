import { Icon, type IconName } from './Icon'

type PlaceholderPageProps = {
  title: string
  description: string
  icon: IconName
}

export function PlaceholderPage({ title, description, icon }: PlaceholderPageProps) {
  return (
    <section aria-labelledby="page-title">
      <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-accent uppercase">Twój trening. Twój progres.</p>
      <h1 id="page-title" className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
      <div className="mt-10 flex min-h-60 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-surface px-6 py-10 text-center">
        <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-white/5 bg-background text-muted">
          <Icon name={icon} width="28" height="28" />
        </div>
        <p className="font-medium text-white">W przygotowaniu</p>
        <p className="mt-2 max-w-64 text-sm leading-6 text-muted">Ta sekcja pojawi się w kolejnych wersjach aplikacji.</p>
      </div>
    </section>
  )
}
