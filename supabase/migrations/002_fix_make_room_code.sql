create or replace function public.make_room_code()
returns text
language plpgsql
volatile
as $$
declare
  generated_code text;
begin
  loop
    generated_code := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 5));
    exit when not exists (select 1 from public.rooms where code = generated_code);
  end loop;

  return generated_code;
end;
$$;
