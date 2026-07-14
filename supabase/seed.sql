-- =============================================================================
-- seed.sql — Inserts one sample quiz ("Обща култура") owned by the first
-- existing auth user. Sign up through the app once BEFORE running this, then:
--   supabase db execute --file supabase/seed.sql      (local CLI)
-- or paste it into the Supabase SQL editor.
--
-- Re-running is safe: it skips seeding if a game titled "Обща култура" already
-- exists for the chosen owner.
-- =============================================================================
do $$
declare
  v_owner uuid;
  v_game  uuid := gen_random_uuid();
  v_r1    uuid := gen_random_uuid();
  v_r2    uuid := gen_random_uuid();
  v_q     uuid;
begin
  select id into v_owner from auth.users order by created_at asc limit 1;
  if v_owner is null then
    raise notice 'No auth user found. Sign up in the app first, then re-run seed.sql.';
    return;
  end if;

  if exists (select 1 from public.games where owner_id = v_owner and title = 'Обща култура') then
    raise notice 'Sample game already exists for this owner — skipping.';
    return;
  end if;

  insert into public.games (id, owner_id, title, description, status, public_scoreboard_enabled)
  values (v_game, v_owner, 'Обща култура', 'Примерен куиз с два кръга и тайбрекър.',
          'published', true);

  insert into public.rounds (id, game_id, title, order_index) values
    (v_r1, v_game, 'Кръг 1 — Наука', 0),
    (v_r2, v_game, 'Кръг 2 — География', 1);

  -- Q1
  v_q := gen_random_uuid();
  insert into public.questions (id, game_id, round_id, text, points, order_index)
    values (v_q, v_game, v_r1, 'Кой химичен елемент има символ „O“?', 1, 0);
  insert into public.question_options (question_id, text, order_index) values
    (v_q, 'Злато', 0), (v_q, 'Кислород', 1), (v_q, 'Осмий', 2), (v_q, 'Олово', 3);
  update public.questions set correct_option_id =
    (select id from public.question_options where question_id = v_q and text = 'Кислород')
    where id = v_q;

  -- Q2
  v_q := gen_random_uuid();
  insert into public.questions (id, game_id, round_id, text, points, order_index)
    values (v_q, v_game, v_r1, 'Колко планети има в Слънчевата система?', 1, 1);
  insert into public.question_options (question_id, text, order_index) values
    (v_q, '7', 0), (v_q, '8', 1), (v_q, '9', 2), (v_q, '10', 3);
  update public.questions set correct_option_id =
    (select id from public.question_options where question_id = v_q and text = '8')
    where id = v_q;

  -- Q3 (2 points)
  v_q := gen_random_uuid();
  insert into public.questions (id, game_id, round_id, text, points, order_index)
    values (v_q, v_game, v_r1, 'Каква е скоростта на светлината във вакуум (приблизително)?', 2, 2);
  insert into public.question_options (question_id, text, order_index) values
    (v_q, '300 000 km/s', 0), (v_q, '150 000 km/s', 1),
    (v_q, '1 000 km/s', 2), (v_q, '3 000 000 km/s', 3);
  update public.questions set correct_option_id =
    (select id from public.question_options where question_id = v_q and text = '300 000 km/s')
    where id = v_q;

  -- Q4
  v_q := gen_random_uuid();
  insert into public.questions (id, game_id, round_id, text, points, order_index)
    values (v_q, v_game, v_r2, 'Коя е столицата на България?', 1, 3);
  insert into public.question_options (question_id, text, order_index) values
    (v_q, 'Пловдив', 0), (v_q, 'Варна', 1), (v_q, 'София', 2), (v_q, 'Бургас', 3);
  update public.questions set correct_option_id =
    (select id from public.question_options where question_id = v_q and text = 'София')
    where id = v_q;

  -- Q5 (2 points)
  v_q := gen_random_uuid();
  insert into public.questions (id, game_id, round_id, text, points, order_index)
    values (v_q, v_game, v_r2, 'Коя е най-дългата река в света?', 2, 4);
  insert into public.question_options (question_id, text, order_index) values
    (v_q, 'Амазонка', 0), (v_q, 'Нил', 1), (v_q, 'Яндзъ', 2), (v_q, 'Мисисипи', 3);
  update public.questions set correct_option_id =
    (select id from public.question_options where question_id = v_q and text = 'Нил')
    where id = v_q;

  -- Q6
  v_q := gen_random_uuid();
  insert into public.questions (id, game_id, round_id, text, points, order_index)
    values (v_q, v_game, v_r2, 'На кой континент се намира пустинята Сахара?', 1, 5);
  insert into public.question_options (question_id, text, order_index) values
    (v_q, 'Азия', 0), (v_q, 'Австралия', 1), (v_q, 'Африка', 2), (v_q, 'Южна Америка', 3);
  update public.questions set correct_option_id =
    (select id from public.question_options where question_id = v_q and text = 'Африка')
    where id = v_q;

  -- Tiebreaker
  insert into public.tiebreakers (game_id, question_text, correct_value, unit_label, instructions)
  values (v_game,
          'През коя година е основана София като столица на България?',
          1879, 'година',
          'Въведете точна година. Печели най-близкото предположение.');

  raise notice 'Sample quiz "Обща култура" created for owner %.', v_owner;
end $$;
