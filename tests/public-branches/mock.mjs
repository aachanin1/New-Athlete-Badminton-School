import http from 'node:http'

export const names = ['แจ้งวัฒนะ', 'พระราม 2', 'รามอินทรา', 'สุวรรณภูมิ', 'เทพารักษ์', 'รัชดา', 'ราชพฤกษ์-ตลิ่งชัน', 'East Ville', 'พุทธมณฑลสาย 1', '345', 'ทวีวัฒนา', 'ปิ่นเกล้า']

// Entirely in-memory reference-data service. No database, credentials or storage.
export async function startMock(port = 63501) {
  let mode = 'twelve'
  const requests = []
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`)
    res.setHeader('Content-Type', 'application/json')
    if (url.pathname === '/fixture' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      const next = JSON.parse(body).mode
      if (!['twelve', 'eleven', 'empty', 'failure', 'recovery'].includes(next)) {
        res.writeHead(400).end('{}'); return
      }
      mode = next
      res.end(JSON.stringify({ mode })); return
    }
    if (url.pathname === '/requests') {
      res.end(JSON.stringify(requests)); return
    }
    if (url.pathname === '/rest/v1/branches') {
      requests.push({ method: req.method, query: Object.fromEntries(url.searchParams), mode })
      if (req.method !== 'GET') { res.writeHead(405).end('{}'); return }
      if (mode === 'failure') { res.writeHead(503).end('{"message":"synthetic read failure"}'); return }
      const rows = names.map((name, index) => ({ id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, name, is_active: mode !== 'eleven' || index !== 11 }))
      rows.push({ id: '00000000-0000-4000-8000-999999999999', name: 'QA inactive branch', is_active: false })
      const active = url.searchParams.get('is_active') === 'eq.true'
      const selected = (url.searchParams.get('select') || '*').split(',')
      const result = (mode === 'empty' ? [] : rows).filter(row => !active || row.is_active)
        .sort((a, b) => a.name.localeCompare(b.name, 'th'))
        .map(row => Object.fromEntries(Object.entries(row).filter(([key]) => selected.includes('*') || selected.includes(key))))
      res.end(JSON.stringify(result)); return
    }
    res.writeHead(404).end('{"message":"not provided by isolated public-branch fixture"}')
  })
  await new Promise((resolve, reject) => server.once('error', reject).listen(port, '127.0.0.1', resolve))
  return server
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  await startMock()
  console.log('Isolated branch reference fixture listening on 127.0.0.1:63501')
}
