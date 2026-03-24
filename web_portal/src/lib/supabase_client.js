import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pycsrmvhztxihjdihbve.supabase.co'
const supabaseAnonKey = 'sb_publishable_Un8l50_1wRv3099cNjmZvA_q6Wm_im_'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
