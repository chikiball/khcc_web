-- Sample rides for local dev. NOT applied in production.
-- Replace UUIDs / set a real leader_id once admins exist.

insert into public.rides (title, starts_at, start_point_name, distance_km, elevation_m, pace_group, route_url, description, status)
values
  (
    'Saturday Bunch — East Coast',
    now() + interval '2 days' + interval '5 hours 45 minutes',
    'Marina Barrage',
    65, 180, 'B',
    'https://www.strava.com/routes/example',
    'Steady B-pace loop. Coffee at the usual spot after.',
    'scheduled'
  ),
  (
    'Hambalang Hill Repeats',
    now() + interval '5 days' + interval '6 hours',
    'Sentul Circuit',
    80, 1200, 'A',
    'https://www.strava.com/routes/example',
    '4× hill repeats. Bring the climbing legs.',
    'scheduled'
  ),
  (
    'Sunday Easy Roll',
    now() + interval '6 days' + interval '6 hours',
    'Knock House',
    40, 90, 'C',
    null,
    'No-drop. New riders welcome.',
    'scheduled'
  );
