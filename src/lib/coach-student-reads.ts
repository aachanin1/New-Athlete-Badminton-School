import { CoachAssignmentDataUnavailableError } from '@/lib/coach-assignment-resolution'

type Operation = { method: 'eq' | 'in' | 'neq' | 'is' | 'lte' | 'order'; args: unknown[] }
type Result = { data: Record<string, unknown>[] | null; error: { message: string } | null; count: number | null }
interface Query extends PromiseLike<Result> {
  eq: (...args: unknown[]) => Query
  in: (...args: unknown[]) => Query
  neq: (...args: unknown[]) => Query
  is: (...args: unknown[]) => Query
  lte: (...args: unknown[]) => Query
  order: (...args: unknown[]) => Query
  range: (from: number, to: number) => Query
  single: () => PromiseLike<unknown>
}
interface Client { from: (table: string) => { select: (columns: string, options?: { count: 'exact' }) => Query } }

const IN_BATCH_SIZE = 100
const PAGE_SIZE = 500
const MAX_PAGES = 20
const MAX_IN_VALUES = 10_000
const MAX_ROWS = 100_000

// Keep the caller's authenticated client and filters. No privileged fallback.
export function createCompleteCoachStudentReadClient(supabaseClient: unknown) {
  const supabase = supabaseClient as Client
  return {
    from(table: string) {
      return {
        select(columns: string) {
          const identity = table === 'coach_branches' ? 'branch_id' : 'id'
          const selectedColumns = columns.split(',').some(column => column.trim() === identity)
            ? columns : `${columns}, ${identity}`
          const operations: Operation[] = []
          const fail = (message: string): never => { throw new CoachAssignmentDataUnavailableError(`Coach student ${table} read failed`, message) }
          const queryFor = (batchIndex = -1, values?: unknown[]) => {
            // Include sort keys so merged batches retain secondary ordering too.
            const sortColumns = operations.filter(operation => operation.method === 'order')
              .map(operation => String(operation.args[0]))
              .filter(column => !selectedColumns.split(',').some(selected => selected.trim() === column))
            let query = supabase.from(table).select([selectedColumns, ...new Set(sortColumns)].join(', '), { count: 'exact' })
            operations.forEach((operation, index) => {
              query = query[operation.method](...(index === batchIndex ? [operation.args[0], values] : operation.args))
            })
            return query
          }
          const load = async () => {
            const largeFilters = operations.map((operation, index) => ({ ...operation, index }))
              .filter(operation => operation.method === 'in' && Array.isArray(operation.args[1]) && operation.args[1].length > IN_BATCH_SIZE)
            if (largeFilters.length > 1) fail('too many large IN dimensions')
            const largeFilter = largeFilters[0]
            const values = largeFilter ? Array.from(new Set(largeFilter.args[1] as unknown[])) : null
            if (values && values.length > MAX_IN_VALUES) fail('exceeded bounded IN values')
            const batches = values ? Array.from({ length: Math.ceil(values.length / IN_BATCH_SIZE) }, (_, index) => values.slice(index * IN_BATCH_SIZE, (index + 1) * IN_BATCH_SIZE)) : [undefined]
            const readBatch = async (batch: unknown[] | undefined) => {
              const rows: Record<string, unknown>[] = [], seen = new Set<unknown>()
              let expected: number | null = null
              for (let page = 0; page < MAX_PAGES; page++) {
                const result = await queryFor(largeFilter?.index, batch).order(identity, { ascending: true }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
                if (result.error) fail(result.error.message)
                if (!Array.isArray(result.data) || !Number.isInteger(result.count) || Number(result.count) < 0) fail('complete row payload/count unavailable')
                if (expected !== null && expected !== result.count) fail('row count changed during pagination')
                expected = result.count
                for (const row of result.data!) {
                  if (row[identity] === undefined || seen.has(row[identity])) fail('missing/duplicate row identity during pagination')
                  seen.add(row[identity]); rows.push(row)
                }
                if (rows.length === expected) return rows
                if (result.data!.length < PAGE_SIZE) fail('pagination ended before the exact row count')
              }
              return fail('exceeded bounded pagination')
            }
            const rows: Record<string, unknown>[] = [], seen = new Set<unknown>()
            for (let index = 0; index < batches.length; index += 4) {
              const results = await Promise.all(batches.slice(index, index + 4).map(readBatch))
              for (const row of results.flat()) {
                if (seen.has(row[identity])) fail('duplicate row across IN batches')
                seen.add(row[identity]); rows.push(row)
              }
              if (rows.length > MAX_ROWS) fail('exceeded bounded result rows')
            }
            // Preserve the caller's order across IN batches (each batch is sorted independently).
            const ordering = operations.filter(operation => operation.method === 'order')
            rows.sort((left, right) => {
              for (const operation of ordering) {
                const column = String(operation.args[0]), options = operation.args[1] as { ascending?: boolean; nullsFirst?: boolean } | undefined
                const a = left[column], b = right[column]
                if (a === b) continue
                if (a === null || a === undefined) return options?.nullsFirst ? -1 : 1
                if (b === null || b === undefined) return options?.nullsFirst ? 1 : -1
                const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
                if (comparison) return options?.ascending === false ? -comparison : comparison
              }
              return String(left[identity]).localeCompare(String(right[identity]))
            })
            return { data: rows, error: null, count: rows.length }
          }
          const proxy = new Proxy({} as Query, {
            get(_target, property) {
              if (property === 'then') return (resolve: (value: Result) => unknown, reject: (error: unknown) => unknown) => load().then(resolve, reject)
              if (property === 'single') return () => queryFor().single()
              if (['eq', 'in', 'neq', 'is', 'lte', 'order'].includes(String(property))) return (...args: unknown[]) => { operations.push({ method: property as Operation['method'], args }); return proxy }
            },
          })
          return proxy
        },
      }
    },
  }
}
