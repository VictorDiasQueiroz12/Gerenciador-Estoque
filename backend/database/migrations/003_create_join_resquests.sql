CREATE TABLE join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID not null references markets(id),
    user_id UUID not null references users(id),
    status varchar(10) not null default 'pending',
    reviewed_by UUID references users(id),
    reviewed_at timestamptz,
    created_at timestamptz not null default current_timestamp,

    constraint join_requests_status
        check (status IN ('pending', 'approved', 'rejected')),

    constraint join_requests_review
        check (
            (
                status = 'pending'
                AND reviewed_by is null
                AND reviewed_at is null
            )
            OR
            (
                status IN ('approved', 'rejected')
                AND reviewed_by is not null
                AND reviewed_at is not null
            )
        )
);

CREATE UNIQUE INDEX join_requests_one_pending
ON join_requests (market_id, user_id)
WHERE status = 'pending';