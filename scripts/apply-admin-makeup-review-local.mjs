import fs from 'node:fs'
import assert from 'node:assert/strict'
import { run, sql } from '../tests/admin-makeup-review/runtime.mjs'
assert.equal(run.target.project, 'AdminMakeupReview20261019')
let source = fs.readFileSync('supabase/migrations/20261019133852_admin_makeup_review_workflow_v1.sql', 'utf8')
if (process.argv.includes('--iterate')) source = source.replaceAll('CREATE FUNCTION public.', 'CREATE OR REPLACE FUNCTION public.').replace('CREATE TABLE public.admin_makeup_review_requests', 'CREATE TABLE IF NOT EXISTS public.admin_makeup_review_requests')
sql(source)
console.log(JSON.stringify({ applied: true, target: run.target.project, mode: process.argv.includes('--iterate') ? 'owned Local iteration' : 'literal migration' }))
