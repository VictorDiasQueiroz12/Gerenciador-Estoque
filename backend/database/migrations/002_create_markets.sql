CREATE TABLE markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) not null,
    access_code_hash varchar(64) not null unique,
    created_at timestamptz not null default current_timestamp,
    update_at timestamptz not null default current_timestamp,

    constraint markets_name_length
        check (char_length(trim(name)) >= 2)
);

CREATE TABLE market_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID not null references markets(id),
    user_id UUID not null references users(id),
    role varchar(10) not null,
    status varchar(10) not null default 'active',
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,

    CONSTRAINT market_members_unique
        unique (market_id, user_id),

    CONSTRAINT market_members_role
        check (role IN ('owner', 'admin', 'member')),

    CONSTRAINT market_members_status
        check (status IN ('active', 'removed', 'banned', 'left')),

    CONSTRAINT market_owner_active
        check (role <> 'owner' OR status = 'active')
);

CREATE unique INDEX market_one_owner
ON market_members (market_id)
WHERE role = 'owner';