import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.103.0/+esm";
import * as config from "../Data/config.js"
import { getRequest } from "../API/API-Communication.js"

export async function getSupabaseConfigInfo() {
    const path = config._BASE_URL + config._EXT_SUPA_CONF;
    return await getRequest(path);
}

let supabase = null;

export async function getSupabaseClient() {
    if (supabase) return supabase;

    const data = await getSupabaseConfigInfo();
    supabase = createClient(data.base_url, data.api_key);
    return supabase;
}