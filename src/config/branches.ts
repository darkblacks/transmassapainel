export type BranchCode = 'RJ' | 'SP' | 'RB'

export interface BranchDefinition {
  code: BranchCode
  name: string
  location: string
  aliases: string[]
}

export const BRANCHES: BranchDefinition[] = [
  { code: 'RJ', name: 'Rio de Janeiro', location: 'Filial Rio de Janeiro', aliases: ['RJ', 'RIO', 'RIO DE JANEIRO'] },
  { code: 'SP', name: 'São Paulo', location: 'Filial São Bernardo do Campo', aliases: ['SP', 'SBC', 'SAO PAULO', 'SAO BERNARDO DO CAMPO'] },
  { code: 'RB', name: 'Ribeirão Preto', location: 'Filial Ribeirão Preto', aliases: ['RB', 'RP', 'RIBEIRAO PRETO'] }
]

function comparable(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

export function canonicalBranchCode(value?: string | null): BranchCode | null {
  const normalized = comparable(value)
  return BRANCHES.find(branch => branch.aliases.includes(normalized))?.code || null
}

export function belongsToBranch(value: string | null | undefined, branch: BranchCode): boolean {
  return canonicalBranchCode(value) === branch
}

export function branchTitle(value?: string | null): string {
  const code = canonicalBranchCode(value)
  const branch = BRANCHES.find(item => item.code === code)
  return branch ? `${branch.code} · ${branch.name}` : String(value || '')
}

