import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const baseline = '133d658024bfa12c2c34a286c79c7cdb7e9235bb'
export function applyReviewRecoveryOverlay(directory, repository = process.cwd()) {
  const dir = fs.realpathSync(directory), root = fs.realpathSync(repository)
  const allowed = path.join(root, '.playwright', 'admin-makeup-review') + path.sep
  assert.ok(dir.startsWith(allowed) && dir !== root, 'Recovery overlays only modify this task artifact directory')
  const read = relative => fs.readFileSync(path.join(dir, relative), 'utf8')
  const write = (relative, value) => fs.writeFileSync(path.join(dir, relative), value)
  const replaceOnce = (text, before, after) => {
    assert.equal(text.split(before).length, 2, 'Recovery Source anchor must match exactly once')
    return text.replace(before, after)
  }
  const stable = relative => execFileSync('git', ['show', baseline + ':' + relative], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 5e6 })
  const client = 'src/components/admin/makeup-client.tsx', queue = 'src/app/api/admin/makeup/queue/route.ts'
  let oldClient = stable(client)
  for (const name of ['sendReviewGroupToCoach', 'requestCoachEvidenceForGroup']) {
    const anchor = `const ${name} = async (group: ReviewSessionGroup) => {`
    oldClient = replaceOnce(oldClient, anchor, anchor + "\n    setError('พักการส่งคำขอโค้ชชั่วคราว กรุณาตรวจผลคำขอเดิมด้านบน')\n    return\n")
  }
  write(client, oldClient)
  write(queue, stable(queue))
  const page = 'src/app/(admin)/admin/makeup/page.tsx'
  let pageSource = read(page)
  pageSource = "import { ReviewRequestRecoveryPanel } from '@/components/admin/review-request-recovery-panel'\n" + pageSource
  pageSource = replaceOnce(pageSource, "return <MakeupClient reviewActorId={user?.id||''}", "return <><ReviewRequestRecoveryPanel actor={user?.id||''} /><MakeupClient")
  pageSource = replaceOnce(pageSource, "reviewTarget={{sessionId:text('tab')==='manage'?null:session,date:text('date')}} />", "reviewTarget={{sessionId:text('tab')==='manage'?null:session,date:text('date')}} /></>")
  write(page, pageSource)
  const control = 'src/lib/admin-makeup-review-release.ts'
  write(control, replaceOnce(read(control), 'reviewRequestsReadOnly = false', 'reviewRequestsReadOnly = true'))
  const files = [client, queue, page, control]
  const proof = { baseline, mode: 'server-enforced-read-only-recovery', files: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex')])) }
  fs.writeFileSync(path.join(dir, 'admin-makeup-review-recovery.json'), JSON.stringify(proof, null, 2), { flag: 'wx' })
  return proof
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(applyReviewRecoveryOverlay(process.argv[2])))
}
