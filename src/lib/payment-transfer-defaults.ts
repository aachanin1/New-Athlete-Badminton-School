import type { PaymentBranch, PaymentTransferAccount } from './payment-settings'

// Owner data, 2026-09-07. Exact live IDs checked before use; the two differently
// spelled names are Owner-confirmed aliases. Read-only defaults, never a DB seed.
export const PAYMENT_TRANSFER_DEFAULT_BRANCHES: PaymentBranch[] = [
  { id: 'aa77eba0-d05e-4539-9606-f55fe8a530ca', name: 'แจ้งวัฒนะ', slug: 'chaengwattana', is_active: true },
  { id: '9eea389d-0eb2-49e9-bf53-245f000f375f', name: 'พระราม 2', slug: 'rama2', is_active: true },
  { id: 'c873d81d-5f2c-4baf-a926-4c4adc1ab173', name: 'รามอินทรา', slug: 'ram-intra', is_active: true },
  { id: 'da5ff28b-23a3-4cdb-87ad-8dc5a39a78c5', name: 'เทพารักษ์', slug: 'theparak', is_active: true },
  { id: '919ce092-f257-46cb-9858-35cc223371b7', name: 'East Ville', slug: 'east-ville', is_active: true },
  { id: '22e34e69-4c13-42fa-9d8b-471b54b09310', name: 'พุทธมณฑลสาย 1', slug: 'พุทธมณฑล', is_active: true },
  { id: '14ae2056-374e-4a65-b516-a2c15220f0fc', name: '345', slug: '345', is_active: true },
  { id: 'a3af38e2-dfc6-4888-91f7-5ee0fa981f7d', name: 'สุวรรณภูมิ', slug: 'suvarnabhumi', is_active: true },
  { id: '3b8f9c44-fe14-4d64-b80c-5f4458ab39c2', name: 'รัชดา', slug: 'ratchada', is_active: true },
  { id: '58495e7e-7f2b-4fe4-af54-4f810b502a5d', name: 'ราชพฤกษ์-ตลิ่งชัน', slug: 'ratchaphruek-talingchan', is_active: true },
  { id: '573d71ef-c74b-4c80-a5dd-cfec70c27898', name: 'ทวีวัฒนา', slug: 'ทวีวัฒนา', is_active: true },
  { id: '6dbd08be-c5f9-4a7a-9999-3d3dad2bcc14', name: 'ปิ่นเกล้า', slug: 'ปิ่นเกล้า', is_active: true },
]

const branch = (index: number) => PAYMENT_TRANSFER_DEFAULT_BRANCHES[index].id
export const PAYMENT_TRANSFER_DEFAULT_ACCOUNTS: PaymentTransferAccount[] = [
  { id: 'scb-chaengwattana', bankName: 'SCB', accountNumber: '1362694923', accountName: 'ทัศนีย์ อรุนแสนไชยา', branchIds: [branch(0)] },
  { id: 'scb-rama2', bankName: 'SCB', accountNumber: '428-234390-1', accountName: 'กุสุมา วิริยะวัฒนาพงศ์', branchIds: [branch(1)] },
  { id: 'bay-ram-intra', bankName: 'กรุงศรี', accountNumber: '804-9-04226-9', accountName: 'พอพล จันดาวรรณ', branchIds: [branch(2)] },
  { id: 'bay-theparak', bankName: 'กรุงศรี', accountNumber: '045-1-46686-5', accountName: 'มณี พรรัตนพิทักษ์', branchIds: [branch(3)] },
  { id: 'bay-east-ville', bankName: 'กรุงศรี', accountNumber: '147-1-86206-5', accountName: 'รชต จันดาวรรณ', branchIds: [branch(4)] },
  { id: 'ttb-phutthamonthon', bankName: 'TTB', accountNumber: '819-2-03705-2', accountName: 'รชต จันดาวรรณ', branchIds: [branch(5)] },
  { id: 'bbl-345', bankName: 'ธ.กรุงเทพ', accountNumber: '097-0-043956', accountName: 'ประพิศ จันดาวรรณ', branchIds: [branch(6)] },
  { id: 'ttb-shared', bankName: 'TTB', accountNumber: '275-2-35617-6', accountName: 'กุสุมา วิริยะวัฒนาพงศ์', branchIds: [7, 8, 9, 10, 11].map(branch) },
]
