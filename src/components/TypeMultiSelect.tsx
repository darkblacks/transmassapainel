import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface Props {
  types: string[]
  selected: string[]
  onChange: (next: string[]) => void
}

export default function TypeMultiSelect({ types, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const allSelected = types.length > 0 && selected.length === types.length

  function toggle(type: string) {
    onChange(
      selected.includes(type)
        ? selected.filter(x => x !== type)
        : [...selected, type]
    )
  }

  return (
    <div className="multi-select">
      <button type="button" onClick={() => setOpen(!open)}>
        <span>
          {allSelected
            ? 'Todos os tipos'
            : selected.length === 0
              ? 'Nenhum tipo'
              : `${selected.length} tipo(s)`}
        </span>
        <ChevronDown/>
      </button>

      {open && (
        <div className="multi-menu">
          <label className="multi-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onChange(allSelected ? [] : [...types])}
            />
            Todos
          </label>

          {types.map(type => (
            <label key={type}>
              <input
                type="checkbox"
                checked={selected.includes(type)}
                onChange={() => toggle(type)}
              />
              <span>{type}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
