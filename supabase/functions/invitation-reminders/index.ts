import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  // Window: invitations expiring between 23h and 25h from now
  const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  // 1. Find invitations expiring in ~24h that haven't had a reminder sent
  const { data: expiringInvites, error: fetchError } = await supabase
    .from('invitations')
    .select('*, workspaces(name)')
    .gt('expires_at', in23Hours.toISOString())
    .lt('expires_at', in25Hours.toISOString())
    .is('reminder_sent_at', null)

  if (fetchError) {
    console.error('Failed to fetch expiring invitations:', fetchError)
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 })
  }

  let processed = 0

  // 2. Send reminder emails for each expiring invitation
  for (const invite of expiringInvites ?? []) {
    try {
      await supabase.auth.admin.inviteUserByEmail(invite.email, {
        data: {
          reminder: true,
          workspace_name: (invite.workspaces as { name: string } | null)?.name ?? 'your workspace',
        },
      })

      // Mark reminder as sent so we don't send it again
      await supabase
        .from('invitations')
        .update({ reminder_sent_at: now.toISOString() })
        .eq('id', invite.id)

      processed++
    } catch (err) {
      console.error(`Failed to send reminder for ${invite.email}:`, err)
    }
  }

  // 3. Clean up invitations that have fully expired
  const { error: deleteError } = await supabase
    .from('invitations')
    .delete()
    .lt('expires_at', now.toISOString())

  if (deleteError) {
    console.error('Failed to cleanup expired invitations:', deleteError)
  }

  return new Response(
    JSON.stringify({ processed, cleanedUp: !deleteError }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
