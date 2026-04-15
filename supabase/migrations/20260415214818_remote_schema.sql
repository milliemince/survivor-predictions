drop extension if exists "pg_net";

drop policy "Admins can read all profiles" on "public"."profiles";

drop policy "Users can update own profile" on "public"."profiles";

drop policy "Users can view own profile" on "public"."profiles";

drop policy "Admins can read all predictions" on "public"."predictions";

drop policy "Admins can read all season predictions" on "public"."season_predictions";

alter table "public"."season_predictions" add column "points_awarded" integer;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT is_admin
  FROM profiles
  WHERE id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.score_question(question_id_input integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$                                                                  
  declare                                                                                                               
    correct text;                                                                                                       
  begin                                                                                                                 
    select correct_answer into correct from questions where id = question_id_input;
                                                                                                                        
    -- Award points when ANY of the user's comma-separated picks
    -- matches ANY of the pipe-separated correct answers
    update predictions
    set points_awarded = (
      select point_value from questions where id = question_id_input
    )                                                                                                                   
    where question_id = question_id_input
      and exists (                                                                                                      
        select 1  
        from unnest(string_to_array(lower(trim(predicted_answer)), ',')) as user_pick
        cross join unnest(string_to_array(lower(trim(correct)), '|')) as correct_pick                                   
        where trim(user_pick) = trim(correct_pick)
      );                                                                                                                
                  
    -- Zero out wrong answers
    update predictions
    set points_awarded = 0
    where question_id = question_id_input                                                                               
      and not exists (
        select 1                                                                                                        
        from unnest(string_to_array(lower(trim(predicted_answer)), ',')) as user_pick
        cross join unnest(string_to_array(lower(trim(correct)), '|')) as correct_pick
        where trim(user_pick) = trim(correct_pick)                                                                      
      );
  end;                                                                                                                  
  $function$
;


  create policy "profiles_delete"
  on "public"."profiles"
  as permissive
  for delete
  to authenticated
using (public.is_admin());



  create policy "profiles_insert"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = id));



  create policy "profiles_select"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (((auth.uid() = id) OR public.is_admin()));



  create policy "profiles_update"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using (((auth.uid() = id) OR public.is_admin()))
with check (((auth.uid() = id) OR public.is_admin()));



  create policy "Admins can read all predictions"
  on "public"."predictions"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE (profiles.is_admin = true))));



  create policy "Admins can read all season predictions"
  on "public"."season_predictions"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));



