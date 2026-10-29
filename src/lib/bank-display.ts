export interface BankDisplay {
  id: string
  name: string
  src: string | null
  background: string
  width: number
  height: number
}

// Display metadata only. Account identity and branch routing remain in
// payment-settings; aliases must never merge or substitute receiving accounts.
export const BANK_DISPLAYS = {
  scb: { id: 'scb', name: 'ธนาคารไทยพาณิชย์', src: '/banks/scb.svg', background: '#4e2e7f', width: 28, height: 28 },
  bay: { id: 'bay', name: 'ธนาคารกรุงศรีอยุธยา', src: '/banks/bay-contrast.svg', background: '#fec43b', width: 28, height: 28 },
  bbl: { id: 'bbl', name: 'ธนาคารกรุงเทพ', src: '/banks/bbl.svg', background: '#1e4598', width: 28, height: 28 },
  ttb: { id: 'ttb', name: 'ธนาคารทหารไทยธนชาต', src: '/banks/ttb-color.png', background: '#ffffff', width: 40, height: 20 },
} as const satisfies Record<string, BankDisplay>

const aliases: Record<string, keyof typeof BANK_DISPLAYS> = {
  scb: 'scb', ไทยพาณิชย์: 'scb', ธนาคารไทยพาณิชย์: 'scb',
  bay: 'bay', กรุงศรี: 'bay', กรุงศรีอยุธยา: 'bay', ธนาคารกรุงศรีอยุธยา: 'bay',
  bbl: 'bbl', กรุงเทพ: 'bbl', ธกรุงเทพ: 'bbl', ธนาคารกรุงเทพ: 'bbl',
  ttb: 'ttb', ทีทีบี: 'ttb', ทหารไทยธนชาต: 'ttb', ธนาคารทหารไทยธนชาต: 'ttb',
}

export function getBankDisplay(bankName: string): BankDisplay {
  const name = bankName.trim()
  const normalized = name.toLowerCase().replace(/[\s.]/g, '')
  const key = Object.hasOwn(aliases, normalized) ? aliases[normalized] : undefined
  return key ? BANK_DISPLAYS[key] : {
    id: 'unknown', name: name || 'ไม่ระบุธนาคาร', src: null,
    background: '#f1f5f9', width: 28, height: 28,
  }
}
