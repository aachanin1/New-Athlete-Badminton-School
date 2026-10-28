import {sql}from'./runtime.mjs'
// Domain SQL statements only. Auth, health checks and this observer are excluded.
export const domainSnapshot=()=>JSON.parse(sql("SELECT jsonb_build_object('calls',coalesce(sum(calls),0),'executionMs',coalesce(sum(total_exec_time),0)) FROM extensions.pg_stat_statements WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND query~'(bookings|booking_sessions|lesson_wallet|pricing_|task10_)' AND query!~'(pg_stat_statements|pg_get_functiondef|CREATE |ALTER |GRANT |REVOKE )'"))
export const flushMetrics=()=>new Promise(resolve=>setTimeout(resolve,1200))
