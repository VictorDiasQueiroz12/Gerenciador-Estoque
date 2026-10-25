CREATE TABLE users(
    id UUID primary key default gen_random_uuid(),
    name varchar(100) not null,
    email varchar(255) not null unique,
    password_hash text not null,
    created_at timestamptz not null default current_timestamp,
    update_at timestamptz not null default current_timestamp,

    constraint users_name_length
        check (char_length(trim(name)) >= 2),

    constraint users_email_normalized
        check (email = lower(trim(email)))
);