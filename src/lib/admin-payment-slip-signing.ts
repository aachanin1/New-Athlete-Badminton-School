/** Page-local pool: preserve input order and surface any Storage error. */
export async function signAdminPaymentSlips<T extends { slip_storage_path: string | null }>(
  rows: readonly T[],
  sign: (path: string | null) => Promise<string | null>,
): Promise<Array<string | null>> {
  const urls = new Array<string | null>(rows.length)
  let next = 0
  let failed = false
  let failure: unknown
  const worker = async () => {
    while (!failed && next < rows.length) {
      const index = next++
      try {
        urls[index] = await sign(rows[index].slip_storage_path)
      } catch (error) {
        failed = true
        failure = error
      }
    }
  }
  // Settle the in-flight calls before rejecting; never return a partial list.
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, worker))
  if (failed) throw failure
  return urls
}
