-- Reference data: courses, all 54 holes, and the 2026 tournament row.
-- Idempotent via ON CONFLICT — safe to re-run.

insert into courses (id, display_name, play_order) values
  ('seven_oaks', 'Seven Oaks', 1),
  ('crockett',   'Crockett',   2),
  ('cedar_hill', 'Cedar Hill', 3)
on conflict (id) do update
  set display_name = excluded.display_name,
      play_order   = excluded.play_order;

insert into holes (id, course_id, hole_number, par, pin_placement, distance_ft, notes) values
  -- Seven Oaks — par 56
  ('seven_oaks_1',  'seven_oaks',  1, 3, 'B',      '333',     'Welcome to Seven Oaks!'),
  ('seven_oaks_2',  'seven_oaks',  2, 4, 'D',      '462',     'Raised basket Straight ahead'),
  ('seven_oaks_3',  'seven_oaks',  3, 3, 'B',      '313',     'Straight ahead behind bush. Raised basket.'),
  ('seven_oaks_4',  'seven_oaks',  4, 3, 'B',      '247',     null),
  ('seven_oaks_5',  'seven_oaks',  5, 3, 'Alt. A', '277',     'Use Astroturf tee pad. Up hill to right.'),
  ('seven_oaks_6',  'seven_oaks',  6, 4, 'B',      '450 ish', 'Use top tee pad.'),
  ('seven_oaks_7',  'seven_oaks',  7, 3, 'B',      '252',     null),
  ('seven_oaks_8',  'seven_oaks',  8, 3, 'Alt. A', '277',     'Big dogleg right.'),
  ('seven_oaks_9',  'seven_oaks',  9, 3, 'B',      '301',     'Straight ahead.'),
  ('seven_oaks_10', 'seven_oaks', 10, 3, 'C',      '254',     'Don''t hit Carl! Closer basket to left.'),
  ('seven_oaks_11', 'seven_oaks', 11, 3, 'B',      '193',     'Straight ahead.'),
  ('seven_oaks_12', 'seven_oaks', 12, 3, 'A',      '266',     null),
  ('seven_oaks_13', 'seven_oaks', 13, 3, 'B',      '318',     'Straight ahead.'),
  ('seven_oaks_14', 'seven_oaks', 14, 3, 'C',      '450 ish', 'Straight ahead long.'),
  ('seven_oaks_15', 'seven_oaks', 15, 3, 'A',      '275 ish', null),
  ('seven_oaks_16', 'seven_oaks', 16, 3, 'B',      '315',     'Up left.'),
  ('seven_oaks_17', 'seven_oaks', 17, 3, 'C',      '288',     null),
  ('seven_oaks_18', 'seven_oaks', 18, 3, 'B',      '446',     'Straight ahead in gravel.'),

  -- Crockett — par 55
  ('crockett_1',  'crockett',  1, 3, 'A', '296', 'Welcome to Crocket!'),
  ('crockett_2',  'crockett',  2, 3, 'B', '312', 'Srtraight left.'),
  ('crockett_3',  'crockett',  3, 3, 'A', '262', 'Behind bushes'),
  ('crockett_4',  'crockett',  4, 3, 'A', '364', 'Straight ahead over hill'),
  ('crockett_5',  'crockett',  5, 3, 'A', '219', 'Behind bushes'),
  ('crockett_6',  'crockett',  6, 3, 'A', '172', 'Short tee pad. No real pad. Throw from behind sign'),
  ('crockett_7',  'crockett',  7, 3, 'B', '224', 'Up hill to the right'),
  ('crockett_8',  'crockett',  8, 3, 'A', '176', 'Through the mando trees'),
  ('crockett_9',  'crockett',  9, 4, 'A', '470', 'Down the hill to the right'),
  ('crockett_10', 'crockett', 10, 3, 'B', '312', 'Down left in the first cove'),
  ('crockett_11', 'crockett', 11, 3, 'A', '291', 'To the right on the bank'),
  ('crockett_12', 'crockett', 12, 3, 'C', '258', 'Over the brush under the trees'),
  ('crockett_13', 'crockett', 13, 3, 'A', '179', 'Raised basket'),
  ('crockett_14', 'crockett', 14, 3, 'A', '460', null),
  ('crockett_15', 'crockett', 15, 3, 'A', '227', 'In thicket of trees'),
  ('crockett_16', 'crockett', 16, 3, 'A', '226', null),
  ('crockett_17', 'crockett', 17, 3, 'A', '276', 'Long in the back'),
  ('crockett_18', 'crockett', 18, 3, 'A', '346', 'Out in the field'),

  -- Cedar Hill — par 61
  ('cedar_hill_1',  'cedar_hill',  1, 3, 'B', '279', 'Welcome to Cedar Hill!'),
  ('cedar_hill_2',  'cedar_hill',  2, 3, 'C', '404', 'Up to the left.'),
  ('cedar_hill_3',  'cedar_hill',  3, 3, 'B', '259', 'Straight ahead.'),
  ('cedar_hill_4',  'cedar_hill',  4, 3, 'B', '267', 'Up to the left.'),
  ('cedar_hill_5',  'cedar_hill',  5, 3, 'A', '222', 'Straight ahead.'),
  ('cedar_hill_6',  'cedar_hill',  6, 3, 'B', '260', 'Dogleg right'),
  ('cedar_hill_7',  'cedar_hill',  7, 4, 'D', '589', 'Raised Basket.'),
  ('cedar_hill_8',  'cedar_hill',  8, 3, 'D', '416', 'All the way back.'),
  ('cedar_hill_9',  'cedar_hill',  9, 5, 'E', '602', 'Use regular tee pad to the right. All the way back.'),
  ('cedar_hill_10', 'cedar_hill', 10, 4, 'A', '295', 'In the house.'),
  ('cedar_hill_11', 'cedar_hill', 11, 3, 'B', '245', 'Top of hill.'),
  ('cedar_hill_12', 'cedar_hill', 12, 3, 'C', '372', 'Up hill to the left.'),
  ('cedar_hill_13', 'cedar_hill', 13, 3, 'A', '228', 'Dogleg left.'),
  ('cedar_hill_14', 'cedar_hill', 14, 3, 'A', '255', 'Straight ahead.'),
  ('cedar_hill_15', 'cedar_hill', 15, 4, 'C', '476', 'Down the hill to the right.'),
  ('cedar_hill_16', 'cedar_hill', 16, 3, 'A', '290', 'Straight right.'),
  ('cedar_hill_17', 'cedar_hill', 17, 3, 'B', '414', 'Straight down the hill. Raised basket.'),
  ('cedar_hill_18', 'cedar_hill', 18, 5, 'F', '753', 'All the way back!')
on conflict (id) do update
  set course_id     = excluded.course_id,
      hole_number   = excluded.hole_number,
      par           = excluded.par,
      pin_placement = excluded.pin_placement,
      distance_ft   = excluded.distance_ft,
      notes         = excluded.notes;

-- 2026 tournament. Set is_active = true so the client picks it up.
insert into tournaments (year, name, is_active) values
  (2026, 'Birdie for Shurdy 2026', true)
on conflict (year) do update
  set name = excluded.name,
      is_active = excluded.is_active;
