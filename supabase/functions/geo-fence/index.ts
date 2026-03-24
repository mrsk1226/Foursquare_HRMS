import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

const offices: OfficeLocation[] = [
  {
    id: 'main_office',
    name: 'Foursquare Main Office',
    latitude: 11.3292918,
    longitude: 77.7007555,
    radius: 100.0,
  },
  {
    id: 'showroom',
    name: 'Foursquare Showroom',
    latitude: 11.3319983,
    longitude: 77.7012905,
    radius: 50.0,
  }
];

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(dp/2) * Math.sin(dp/2) +
          Math.cos(p1) * Math.cos(p2) *
          Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

serve(async (req) => {
  try {
    const { employeeId, lat, lng, type, officeId } = await req.json()
    
    // Validate Office
    const office = offices.find(o => o.id === officeId);
    if (!office) {
      return new Response(JSON.stringify({ error: "Invalid office location" }), { status: 400 })
    }

    // Verify Geofence
    const distance = getDistanceInMeters(lat, lng, office.latitude, office.longitude);
    if (distance > office.radius) {
      return new Response(JSON.stringify({ error: `Not within ${office.radius}m of ${office.name}. Distance: ${Math.round(distance)}m` }), { status: 403 })
    }

    // Connect to Supabase to punch
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    if (type === 'in') {
      const { error } = await supabaseClient.from('attendance_logs').insert([{
        employee_id: employeeId,
        check_in: now,
        date: today,
        lat,
        lng,
        status: 'present'
      }]);
      if (error) throw error;
    } else {
      const { data, error: fetchErr } = await supabaseClient.from('attendance_logs')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .is('check_out', null)
        .single();
        
      if (fetchErr) throw fetchErr;
      
      const { error } = await supabaseClient.from('attendance_logs')
        .update({ check_out: now })
        .eq('id', data.id);
      if (error) throw error;
    }
    
    return new Response(JSON.stringify({ success: true, message: `Punched ${type} at ${office.name}` }), { headers: { "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
