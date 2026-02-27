create or replace function score_question(question_id_input int)
returns void language plpgsql security definer as $$
declare
  correct text;
begin
  select correct_answer into correct from questions where id = question_id_input;

  update predictions
  set points_awarded = (
    select point_value from questions where id = question_id_input
  )
  where question_id = question_id_input
    and lower(trim(predicted_answer)) = lower(trim(correct));

  -- Zero out wrong answers
  update predictions
  set points_awarded = 0
  where question_id = question_id_input
    and lower(trim(predicted_answer)) != lower(trim(correct));
end;
$$;
