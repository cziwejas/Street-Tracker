import { useRef, useState } from 'react'
import { adjustStepperValue, parseStepperInput } from './inputHelpers'

interface NumberStepperProps {
  id: string
  label: string
  unit?: string
  value: number
  step?: number
  min?: number
  max?: number
  integer?: boolean
  inputMode?: 'numeric' | 'decimal'
  disabled?: boolean
  onChange: (value: number) => void
}

export function NumberStepper({ id, label, unit, value, step = 1, min = 0, max, integer = false, inputMode = integer ? 'numeric' : 'decimal', disabled = false, onChange }: NumberStepperProps) {
  const input = useRef<HTMLInputElement>(null)
  const [editingText, setEditingText] = useState<string | null>(null)
  const invalid = editingText !== null && parseStepperInput(editingText, { min, max, integer }) === undefined
  const buttonClass = 'flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-lg bg-white/7 text-2xl font-light transition-colors hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-30 motion-reduce:transition-none'

  function adjust(delta: number) {
    setEditingText(null)
    input.current?.setCustomValidity('')
    onChange(adjustStepperValue(value, delta, min, max))
  }

  return (
    <div className="stepper min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">{label}{unit ? ` (${unit})` : ''}</label>
      <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-background p-1">
        <button type="button" className={buttonClass} aria-label={`Zmniejsz: ${label}`} disabled={disabled || value <= min} onClick={() => adjust(-step)}>−</button>
        <input
          ref={input}
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          required
          value={editingText ?? String(value)}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className="min-h-11 w-full min-w-0 rounded-lg border-0 bg-transparent px-1 text-center text-2xl font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent aria-invalid:ring-2 aria-invalid:ring-red-400 disabled:opacity-40"
          onFocus={(event) => { setEditingText((current) => current ?? String(value)); event.currentTarget.select() }}
          onChange={(event) => {
            const text = event.currentTarget.value
            setEditingText(text)
            const parsed = parseStepperInput(text, { min, max, integer })
            event.currentTarget.setCustomValidity(parsed === undefined ? 'Wpisz poprawną liczbę w dozwolonym zakresie.' : '')
            if (parsed !== undefined) onChange(parsed)
          }}
          onBlur={(event) => {
            if (parseStepperInput(event.currentTarget.value, { min, max, integer }) !== undefined) {
              setEditingText(null)
              event.currentTarget.setCustomValidity('')
            }
          }}
        />
        <button type="button" className={buttonClass} aria-label={`Zwiększ: ${label}`} disabled={disabled || (max !== undefined && value >= max)} onClick={() => adjust(step)}>+</button>
      </div>
    </div>
  )
}
