export const BRANCHES = [
  { name: 'แจ้งวัฒนะ', slug: 'chaengwattana' },
  { name: 'พระราม 2', slug: 'rama2' },
  { name: 'รามอินทรา', slug: 'ram-intra' },
  { name: 'สุวรรณภูมิ', slug: 'suvarnabhumi' },
  { name: 'เทพารักษ์', slug: 'theparak' },
  { name: 'รัชดา', slug: 'ratchada' },
  { name: 'ราชพฤกษ์-ตลิ่งชัน', slug: 'ratchaphruek-talingchan' },
] as const

export type BranchSlug = (typeof BRANCHES)[number]['slug']
