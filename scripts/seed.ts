import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const users = [
  { clerk_user_id: 'user_seed_001', email: 'alice@example.com', plan: 'pro', created_at: daysAgo(180) },
  { clerk_user_id: 'user_seed_002', email: 'bob@example.com', plan: 'free', created_at: daysAgo(120) },
  { clerk_user_id: 'user_seed_003', email: 'carol@example.com', plan: 'enterprise', created_at: daysAgo(90) },
  { clerk_user_id: 'user_seed_004', email: 'dave@example.com', plan: 'pro', created_at: daysAgo(60) },
  { clerk_user_id: 'user_seed_005', email: 'eve@example.com', plan: 'free', created_at: daysAgo(14) },
]

const devices = ['desktop', 'mobile', 'tablet']
const countries = ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'JP', 'BR']
const eventTypes = ['page_view', 'question_asked', 'answer_given', 'payment_made', 'session_end']

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function hoursAgo(n: number): string {
  const d = new Date()
  d.setHours(d.getHours() - n)
  return d.toISOString()
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function eventProperties(type: string, sessionId: string): Record<string, unknown> {
  switch (type) {
    case 'page_view':
      return { path: pick(['/overview', '/behaviour', '/trends', '/predictions']), referrer: '/', duration_ms: randomBetween(1000, 30000) }
    case 'question_asked':
      return { question_id: `q_${Math.random().toString(36).slice(2, 9)}`, category: pick(['analytics', 'revenue', 'users']), length_chars: randomBetween(20, 300) }
    case 'answer_given':
      return { question_id: `q_${Math.random().toString(36).slice(2, 9)}`, latency_ms: randomBetween(200, 2000), model: 'v2', satisfied: pick([true, false, null]) }
    case 'payment_made':
      return { amount: pick([9, 29, 49, 99]), currency: 'USD', plan: pick(['pro', 'enterprise']), interval: pick(['monthly', 'annual']), payment_id: `pay_${Math.random().toString(36).slice(2, 9)}` }
    case 'session_end':
      return { session_id: sessionId, duration_ms: randomBetween(60000, 600000), events_in_session: randomBetween(3, 25), reason: pick(['tab_close', 'inactivity', 'sign_out']) }
    default:
      return {}
  }
}

async function seed() {
  console.log('Seeding users...')
  const { error: userError } = await supabase.from('users').upsert(users)
  if (userError) throw userError

  console.log('Seeding funnels...')
  const { error: funnelError } = await supabase.from('funnels').upsert([
    { id: 'a1b2c3d4-0000-0000-0000-000000000001', name: 'Activation Funnel', steps: ['sign_up', 'question_asked', 'payment_made'] },
    { id: 'a1b2c3d4-0000-0000-0000-000000000002', name: 'Engagement Funnel', steps: ['page_view', 'question_asked', 'answer_given'] },
    { id: 'a1b2c3d4-0000-0000-0000-000000000003', name: 'Revenue Funnel', steps: ['sign_up', 'payment_made'] },
  ])
  if (funnelError) throw funnelError

  for (const user of users) {
    console.log(`Seeding sessions + events for ${user.email}...`)

    const sessionRows = []
    const eventRows = []

    for (let s = 0; s < 10; s++) {
      const startedAt = new Date(Date.now() - randomBetween(1, 60) * 24 * 60 * 60 * 1000)
      const endedAt = new Date(startedAt.getTime() + randomBetween(5, 90) * 60 * 1000)
      const sessionId = crypto.randomUUID()

      sessionRows.push({
        id: sessionId,
        clerk_user_id: user.clerk_user_id,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        device: pick(devices),
        country: pick(countries),
      })

      for (let e = 0; e < randomBetween(3, 8); e++) {
        const type = pick(eventTypes)
        eventRows.push({
          clerk_user_id: user.clerk_user_id,
          event_type: type,
          properties: eventProperties(type, sessionId),
          created_at: new Date(startedAt.getTime() + e * randomBetween(30000, 300000)).toISOString(),
        })
      }
    }

    // sign_up event
    eventRows.push({
      clerk_user_id: user.clerk_user_id,
      event_type: 'sign_up',
      properties: { plan: user.plan, source: pick(['organic', 'twitter', 'referral']) },
      created_at: user.created_at,
    })

    const { error: sessionError } = await supabase.from('sessions').insert(sessionRows)
    if (sessionError) throw sessionError

    const { error: eventError } = await supabase.from('events').insert(eventRows)
    if (eventError) throw eventError

    console.log(`Seeding predictions for ${user.email}...`)
    const { error: predError } = await supabase.from('predictions').insert([
      {
        clerk_user_id: user.clerk_user_id,
        model_type: 'churn_v1',
        prediction: { churn_score: Math.random().toFixed(2), days_since_last_session: randomBetween(1, 30), risk_level: pick(['low', 'medium', 'high']), signal: 'inactivity' },
      },
      {
        clerk_user_id: user.clerk_user_id,
        model_type: 'revenue_forecast_v1',
        prediction: { forecast_30d: randomBetween(50, 500), forecast_90d: randomBetween(150, 1500), confidence: parseFloat((Math.random() * 0.4 + 0.6).toFixed(2)), basis: 'cohort_average' },
      },
      {
        clerk_user_id: user.clerk_user_id,
        model_type: 'engagement_trend_v1',
        prediction: { trend: pick(['improving', 'stable', 'declining']), '7d_avg_sessions': parseFloat((Math.random() * 3 + 0.5).toFixed(1)), '30d_avg_sessions': parseFloat((Math.random() * 5 + 1).toFixed(1)), pct_change: parseFloat(((Math.random() - 0.5) * 100).toFixed(1)) },
      },
    ])
    if (predError) throw predError
  }

  console.log('Seed complete.')
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
