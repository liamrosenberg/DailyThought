import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // 1. Connect to your database using the secure environment variables
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Get the new thought data from the incoming webhook request
    const payload = await req.json()
    const newThought = payload.record // This is the row that was just inserted

    // 3. Fetch EVERY push token from your profiles table
    const { data: profiles, error } = await supabaseClient
      .from('profiles')
      .select('push_token')
      .not('push_token', 'is', null)

    if (error) throw error;

    // 4. Format the messages exactly how Expo wants them
    const messages = [];
    for (const profile of profiles) {
      if (profile.push_token) {
        messages.push({
          to: profile.push_token,
          sound: 'default',
          title: 'New Daily Thought! 💭',
          body: newThought.content,
        })
      }
    }

    // 5. Send the massive payload to Expo's Push API
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const expoData = await expoResponse.json();

    return new Response(JSON.stringify({ success: true, data: expoData }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})