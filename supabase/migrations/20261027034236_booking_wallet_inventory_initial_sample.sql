BEGIN;

-- Include at most 32 initial sources so the first calendar opens without another read.
-- Counts still cover every group, independently of this bounded sample.
-- Existing entitlement, redemption, expiry and Admin writers are untouched.
CREATE OR REPLACE FUNCTION public.booking_ux_wallet_inventory_v1(p_actor uuid,p_group text DEFAULT NULL,p_selected uuid[] DEFAULT '{}'::uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_now timestamptz:=public.task10_clock_v1();v_previous date;v_makeup jsonb;v_result jsonb;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor) THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
  IF p_group IS NOT NULL AND p_group!~'^[a-f0-9]{32}$' OR p_selected IS NULL OR cardinality(p_selected)>32
    OR cardinality(p_selected)<>(SELECT count(DISTINCT x) FROM unnest(p_selected)x) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
  v_previous:=(date_trunc('month',v_now AT TIME ZONE 'Asia/Bangkok')-interval '1 month')::date;
  SELECT coalesce(jsonb_agg(state ORDER BY month),'[]') INTO v_makeup FROM (
    SELECT m.month,public.booking_ux_parent_state_v1(p_actor,m.month) AS state FROM (
      SELECT DISTINCT date_trunc('month',c.original_date)::date AS month
      FROM lesson_wallet_credits c JOIN course_types ct ON ct.id=c.course_type_id
      WHERE c.user_id=p_actor AND ct.name::text='kids_group' AND c.status IN ('active','expired')
        AND (c.expires_at>v_now OR c.original_date>=v_previous)
        AND (date_trunc('month',c.original_date)+interval '2 months') AT TIME ZONE 'Asia/Bangkok'>v_now
    )m
  )s WHERE jsonb_typeof(state->'sources')='array';

  WITH makeup_sources AS MATERIALIZED (
    SELECT (s.value->>'creditId')::uuid AS credit_id,m.value->>'sourceMonth' AS makeup_month,
      m.value->>'destinationMonth' AS destination_month,coalesce((m.value->>'eligible')::boolean,false) AS makeup_eligible
    FROM jsonb_array_elements(v_makeup)m CROSS JOIN LATERAL jsonb_array_elements(m.value->'sources')s
    WHERE s.value->>'creditId' IS NOT NULL
  ), credits AS MATERIALIZED (
    SELECT c.*,ct.name::text AS course,
      coalesce((SELECT jsonb_agg(cm.child_id ORDER BY cm.original_session_id) FROM lesson_wallet_credit_members cm WHERE cm.credit_id=c.id),jsonb_build_array(c.child_id)) AS people,
      m.makeup_month,m.destination_month,coalesce(m.makeup_eligible,false) AS makeup_eligible
    FROM lesson_wallet_credits c JOIN course_types ct ON ct.id=c.course_type_id
    LEFT JOIN makeup_sources m ON m.credit_id=c.id
    WHERE c.user_id=p_actor AND c.status IN ('active','expired') AND c.redeemed_session_id IS NULL
      AND (c.expires_at>v_now OR c.original_date>=v_previous)
      AND NOT EXISTS(SELECT 1 FROM task10_family_makeup_uses u WHERE u.parent_id=p_actor AND
        (u.credit_id=c.id OR u.source_session_id=c.original_session_id OR u.source_root_id=c.original_session_id))
  ), raw AS (
    SELECT c.id,c.booking_id,'wallet'::text AS kind,c.course,c.people,c.expires_at,c.entitlement_policy AS policy,
      CASE WHEN c.entitlement_policy='same_month' THEN to_char(c.original_date,'YYYY-MM') END AS original_month,
      c.original_date,NULL::integer AS validity_months,(c.status='active' AND c.expires_at>v_now) AS normal,
      c.makeup_month,c.destination_month,c.makeup_eligible
    FROM credits c
    UNION ALL
    SELECT u.id,u.booking_id,'package',ct.name::text,u.participants,u.expires_at,
      'package:'||(b.package_snapshot->>'validity_months'),NULL,NULL::date,(b.package_snapshot->>'validity_months')::integer,true,NULL,NULL,false
    FROM bookings b JOIN booking_package_units u ON u.booking_id=b.id JOIN course_types ct ON ct.id=b.course_type_id
    WHERE b.user_id=p_actor AND u.status='available' AND u.expires_at>v_now
  ), keyed AS MATERIALIZED (
    SELECT r.*,md5(jsonb_build_array(kind,course,
      (SELECT jsonb_agg(coalesce(x.value#>>'{}','self') ORDER BY coalesce(x.value#>>'{}','self')) FROM jsonb_array_elements(people)x),
      floor(extract(epoch FROM expires_at)*1000),policy,coalesce(original_month,''),
      CASE WHEN makeup_eligible THEN jsonb_build_array(makeup_month,destination_month) END,
      normal,makeup_month)::text) AS group_id
    FROM raw r WHERE normal OR makeup_month IS NOT NULL
  ), counts AS (
    SELECT group_id,count(*) AS total FROM keyed GROUP BY group_id
  ), representative AS (
    SELECT DISTINCT ON(group_id) * FROM keyed ORDER BY group_id,expires_at,id
  ), wanted AS (
    SELECT * FROM keyed WHERE p_group IS NULL OR group_id=p_group ORDER BY expires_at,id LIMIT 32
  ), selected AS (
    SELECT * FROM keyed WHERE id=ANY(p_selected)
  ), member_rows AS (
    SELECT DISTINCT ON(id) * FROM (SELECT * FROM wanted UNION ALL SELECT * FROM selected)s ORDER BY id
  ), payload_rows AS (
    SELECT 'representative'::text AS role,r.* FROM representative r
    UNION ALL SELECT 'member',r.* FROM member_rows r
  ), payload AS (
    SELECT role,group_id,expires_at,course,kind,id,jsonb_build_object('id',id,'bookingId',booking_id,'kind',kind,'course',course,
      'participants',people,'expires',expires_at,'policy',policy,'originalMonth',original_month,'originalDate',original_date,
      'validityMonths',validity_months,'normal',normal,'makeupMonth',makeup_month,'groupId',group_id) AS source
    FROM payload_rows
  ) SELECT jsonb_build_object('serverNow',v_now,'makeup',v_makeup,'groups',(
      SELECT coalesce(jsonb_agg(jsonb_build_object('key',p.group_id,'total',c.total,'source',p.source) ORDER BY p.expires_at,p.kind,p.course,p.group_id),'[]')
      FROM payload p JOIN counts c ON c.group_id=p.group_id WHERE p.role='representative'),
    'sources',(SELECT coalesce(jsonb_agg(source ORDER BY expires_at,id),'[]') FROM payload WHERE role='member')) INTO v_result;
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.booking_ux_wallet_inventory_v1(uuid,text,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.booking_ux_wallet_inventory_v1(uuid,text,uuid[]) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
